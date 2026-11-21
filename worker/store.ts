import { BRANCH_IDS, type BranchId } from './authCore.ts';
import { SupabaseRestClient, type SupabaseConfig } from './supabaseRest.ts';

export interface KvStoreLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface StoreBackend {
  kv?: KvStoreLike;
  db?: SupabaseConfig;
}

export type StoreRef = KvStoreLike | StoreBackend | undefined;

function splitBackend(store: StoreRef): { kv?: KvStoreLike; db?: SupabaseRestClient } {
  if (!store) return {};
  if ('get' in store && typeof store.get === 'function') {
    return { kv: store as KvStoreLike };
  }
  const backend = store as StoreBackend;
  return {
    kv: backend.kv,
    db: backend.db?.url && backend.db?.serviceRoleKey ? new SupabaseRestClient(backend.db) : undefined,
  };
}

export interface ServerIpLogEntry {
  id: string;
  ip: string;
  memberName: string;
  branchId: string;
  event: 'visit' | 'login' | 'failed_pin' | 'banned_attempt' | 'pin_rotated' | 'leader_rotated';
  timestamp: number;
  country?: string;
  city?: string;
  userAgent: string;
}

export interface ServerBanEntry {
  ip: string;
  reason: string;
  bannedAt: number;
  bannedBy: string;
}

export interface RateLimitState {
  attempts: number;
  windowStart: number;
  lockedUntil: number;
}

const MAX_LOG_ENTRIES = 100;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const KEY_LOGS = 'security:logs';
const KEY_BANS = 'security:bans';
const KEY_WEBHOOK = 'security:discord_webhook';
const KEY_FORCE_LOGOUT = 'security:force_logout_after';
const KEY_GROUP_NAMES = 'security:group_names';

const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

async function readKey(kv: KvStoreLike | undefined, key: string): Promise<string | null> {
  if (kv) {
    return kv.get(key);
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function writeKey(
  kv: KvStoreLike | undefined,
  key: string,
  value: string,
  expirationTtlSeconds?: number
): Promise<void> {
  if (kv) {
    const safeTtl =
      typeof expirationTtlSeconds === 'number'
        ? Math.max(60, Math.floor(expirationTtlSeconds))
        : undefined;
    await kv.put(key, value, safeTtl ? { expirationTtl: safeTtl } : undefined);
    return;
  }
  memoryStore.set(key, {
    value,
    expiresAt:
      typeof expirationTtlSeconds === 'number'
        ? Date.now() + expirationTtlSeconds * 1000
        : undefined,
  });
}

async function readJson<T>(kv: KvStoreLike | undefined, key: string, fallback: T): Promise<T> {
  const raw = await readKey(kv, key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getBanList(store?: StoreRef): Promise<ServerBanEntry[]> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{
      ip: string;
      reason: string;
      banned_by: string;
      banned_at: number;
    }>('ip_bans', 'order=banned_at.desc');
    return rows.map((r) => ({
      ip: r.ip,
      reason: r.reason,
      bannedBy: r.banned_by,
      bannedAt: Number(r.banned_at),
    }));
  }
  const bans = await readJson<ServerBanEntry[]>(kv, KEY_BANS, []);
  return Array.isArray(bans) ? bans : [];
}

export async function findBanByIp(ip: string, store?: StoreRef): Promise<ServerBanEntry | null> {
  if (!ip || ip === 'unknown') return null;
  const { db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{
      ip: string;
      reason: string;
      banned_by: string;
      banned_at: number;
    }>('ip_bans', `ip=eq.${encodeURIComponent(ip)}&limit=1`);
    const r = rows[0];
    return r ? { ip: r.ip, reason: r.reason, bannedBy: r.banned_by, bannedAt: Number(r.banned_at) } : null;
  }
  const bans = await getBanList(store);
  return bans.find((entry) => entry.ip === ip) ?? null;
}

export async function addBan(
  ip: string,
  reason: string,
  bannedBy: string,
  store?: StoreRef
): Promise<ServerBanEntry[]> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.upsert(
      'ip_bans',
      [{ ip, reason, banned_by: bannedBy, banned_at: Date.now() }],
      'ip'
    );
    return getBanList(store);
  }
  const bans = await getBanList(store);
  const filtered = bans.filter((entry) => entry.ip !== ip);
  const next: ServerBanEntry[] = [
    { ip, reason, bannedAt: Date.now(), bannedBy },
    ...filtered,
  ];
  await writeKey(kv, KEY_BANS, JSON.stringify(next));
  return next;
}

export async function removeBan(ip: string, store?: StoreRef): Promise<ServerBanEntry[]> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.deleteRows('ip_bans', `ip=eq.${encodeURIComponent(ip)}`);
    return getBanList(store);
  }
  const bans = await getBanList(store);
  const next = bans.filter((entry) => entry.ip !== ip);
  await writeKey(kv, KEY_BANS, JSON.stringify(next));
  return next;
}

export async function getSecurityLogs(store?: StoreRef): Promise<ServerIpLogEntry[]> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{
      id: string;
      ip: string;
      member_name: string;
      branch_id: string;
      event: ServerIpLogEntry['event'];
      country: string;
      city: string;
      user_agent: string;
      created_at: number;
    }>('security_logs', `order=created_at.desc&limit=${MAX_LOG_ENTRIES}`);
    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      memberName: r.member_name,
      branchId: r.branch_id,
      event: r.event,
      country: r.country || undefined,
      city: r.city || undefined,
      userAgent: r.user_agent,
      timestamp: Number(r.created_at),
    }));
  }
  const logs = await readJson<ServerIpLogEntry[]>(kv, KEY_LOGS, []);
  return Array.isArray(logs) ? logs : [];
}

export async function appendSecurityLog(
  entry: Omit<ServerIpLogEntry, 'id' | 'timestamp'>,
  store?: StoreRef
): Promise<ServerIpLogEntry> {
  const { kv, db } = splitBackend(store);
  const fullEntry: ServerIpLogEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  if (db) {
    await db.insert('security_logs', [
      {
        id: fullEntry.id,
        ip: fullEntry.ip,
        member_name: fullEntry.memberName,
        branch_id: fullEntry.branchId,
        event: fullEntry.event,
        country: fullEntry.country || '',
        city: fullEntry.city || '',
        user_agent: fullEntry.userAgent || '',
        created_at: fullEntry.timestamp,
      },
    ]);
    return fullEntry;
  }
  const logs = await getSecurityLogs(store);
  const next = [fullEntry, ...logs].slice(0, MAX_LOG_ENTRIES);
  await writeKey(kv, KEY_LOGS, JSON.stringify(next));
  return fullEntry;
}

export async function getRateLimitStatus(
  ip: string,
  store?: StoreRef,
  nowMs = Date.now()
): Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const { kv, db } = splitBackend(store);
  let state: RateLimitState | null = null;
  if (db) {
    const rows = await db.select<{
      attempts: number;
      window_start: number;
      locked_until: number;
    }>('rate_limits', `ip=eq.${encodeURIComponent(ip)}&limit=1`);
    if (rows[0]) {
      state = {
        attempts: Number(rows[0].attempts),
        windowStart: Number(rows[0].window_start),
        lockedUntil: Number(rows[0].locked_until),
      };
    }
  } else {
    state = await readJson<RateLimitState | null>(kv, `security:rl:${ip}`, null);
  }
  if (!state) {
    return { locked: false, retryAfterSec: 0, remainingAttempts: MAX_ATTEMPTS };
  }
  if (state.lockedUntil > nowMs) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((state.lockedUntil - nowMs) / 1000),
      remainingAttempts: 0,
    };
  }
  if (nowMs - state.windowStart > RATE_WINDOW_MS) {
    return { locked: false, retryAfterSec: 0, remainingAttempts: MAX_ATTEMPTS };
  }
  return {
    locked: false,
    retryAfterSec: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - state.attempts),
  };
}

export async function recordFailedAttempt(
  ip: string,
  store?: StoreRef,
  nowMs = Date.now()
): Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const { kv, db } = splitBackend(store);
  let prev: RateLimitState | null = null;
  if (db) {
    const rows = await db.select<{
      attempts: number;
      window_start: number;
      locked_until: number;
    }>('rate_limits', `ip=eq.${encodeURIComponent(ip)}&limit=1`);
    if (rows[0]) {
      prev = {
        attempts: Number(rows[0].attempts),
        windowStart: Number(rows[0].window_start),
        lockedUntil: Number(rows[0].locked_until),
      };
    }
  } else {
    prev = await readJson<RateLimitState | null>(kv, `security:rl:${ip}`, null);
  }

  let nextState: RateLimitState;
  if (!prev || nowMs - prev.windowStart > RATE_WINDOW_MS) {
    nextState = { attempts: 1, windowStart: nowMs, lockedUntil: 0 };
  } else {
    const attempts = prev.attempts + 1;
    nextState = {
      attempts,
      windowStart: prev.windowStart,
      lockedUntil: attempts >= MAX_ATTEMPTS ? nowMs + LOCKOUT_MS : 0,
    };
  }

  if (db) {
    await db.upsert(
      'rate_limits',
      [
        {
          ip,
          attempts: nextState.attempts,
          window_start: nextState.windowStart,
          locked_until: nextState.lockedUntil,
        },
      ],
      'ip'
    );
  } else {
    await writeKey(kv, `security:rl:${ip}`, JSON.stringify(nextState), 30 * 60);
  }

  return {
    locked: nextState.lockedUntil > nowMs,
    retryAfterSec:
      nextState.lockedUntil > nowMs
        ? Math.ceil((nextState.lockedUntil - nowMs) / 1000)
        : 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextState.attempts),
  };
}

export async function clearRateLimit(ip: string, store?: StoreRef): Promise<void> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.deleteRows('rate_limits', `ip=eq.${encodeURIComponent(ip)}`);
    return;
  }
  await writeKey(
    kv,
    `security:rl:${ip}`,
    JSON.stringify({ attempts: 0, windowStart: Date.now(), lockedUntil: 0 }),
    60
  );
}

export async function getForceLogoutAfter(store?: StoreRef): Promise<number> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ value: string }>('app_settings', `key=eq.${KEY_FORCE_LOGOUT}&limit=1`);
    const parsed = Number(rows[0]?.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const raw = await readKey(kv, KEY_FORCE_LOGOUT);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setForceLogoutAfter(timestampMs: number, store?: StoreRef): Promise<void> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.upsert(
      'app_settings',
      [{ key: KEY_FORCE_LOGOUT, value: String(timestampMs), updated_at: new Date().toISOString() }],
      'key'
    );
    return;
  }
  await writeKey(kv, KEY_FORCE_LOGOUT, String(timestampMs));
}

export async function getBranchMemberForceLogoutAfter(
  branchId: string,
  store?: StoreRef
): Promise<number> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ member_force_logout_after: number }>(
      'groups',
      `id=eq.${encodeURIComponent(branchId)}&select=member_force_logout_after&limit=1`
    );
    const parsed = Number(rows[0]?.member_force_logout_after);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const raw = await readKey(kv, `security:force_logout_member:${branchId}`);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) ? parsed : 0;
}

export async function setBranchMemberForceLogoutAfter(
  branchId: string,
  timestampMs: number,
  store?: StoreRef
): Promise<void> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
      member_force_logout_after: timestampMs,
      updated_at: new Date().toISOString(),
    });
    return;
  }
  await writeKey(kv, `security:force_logout_member:${branchId}`, String(timestampMs), 36 * 60 * 60);
}

export async function getBranchLeaderForceLogoutAfter(
  branchId: string,
  store?: StoreRef
): Promise<number> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ leader_force_logout_after: number }>(
      'groups',
      `id=eq.${encodeURIComponent(branchId)}&select=leader_force_logout_after&limit=1`
    );
    const parsed = Number(rows[0]?.leader_force_logout_after);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const raw = await readKey(kv, `security:force_logout_leader:${branchId}`);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) ? parsed : 0;
}

export async function setBranchLeaderForceLogoutAfter(
  branchId: string,
  timestampMs: number,
  store?: StoreRef
): Promise<void> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
      leader_force_logout_after: timestampMs,
      updated_at: new Date().toISOString(),
    });
    return;
  }
  await writeKey(kv, `security:force_logout_leader:${branchId}`, String(timestampMs), 36 * 60 * 60);
}

interface StoredDailyEpoch {
  date: string;
  epoch: number;
}

export async function getMemberPinEpoch(
  branchId: string,
  dateStr: string,
  store?: StoreRef
): Promise<number> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ member_pin_date: string | null; member_pin_epoch: number }>(
      'groups',
      `id=eq.${encodeURIComponent(branchId)}&select=member_pin_date,member_pin_epoch&limit=1`
    );
    const row = rows[0];
    if (!row || row.member_pin_date !== dateStr) return 0;
    return Math.max(0, Math.floor(Number(row.member_pin_epoch) || 0));
  }
  const stored = await readJson<StoredDailyEpoch | null>(kv, `pin_epoch:${branchId}`, null);
  if (!stored || stored.date !== dateStr || typeof stored.epoch !== 'number') {
    return 0;
  }
  return Math.max(0, Math.floor(stored.epoch));
}

export async function getMemberPinEpochs(
  dateStr: string,
  store?: StoreRef
): Promise<Record<BranchId, number>> {
  const { db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ id: string; member_pin_date: string | null; member_pin_epoch: number }>(
      'groups',
      'select=id,member_pin_date,member_pin_epoch'
    );
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const out = {} as Record<BranchId, number>;
    for (const branchId of BRANCH_IDS) {
      const r = rowMap.get(branchId);
      out[branchId] = r && r.member_pin_date === dateStr ? Math.max(0, Math.floor(Number(r.member_pin_epoch) || 0)) : 0;
    }
    return out;
  }
  const entries = await Promise.all(
    BRANCH_IDS.map(async (b) => [b, await getMemberPinEpoch(b, dateStr, store)] as const)
  );
  return Object.fromEntries(entries) as Record<BranchId, number>;
}

export async function rotateMemberPinEpoch(
  branchId: string,
  dateStr: string,
  store?: StoreRef
): Promise<number> {
  const { kv, db } = splitBackend(store);
  const current = await getMemberPinEpoch(branchId, dateStr, store);
  const nextEpoch = current + 1;
  if (db) {
    await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
      member_pin_date: dateStr,
      member_pin_epoch: nextEpoch,
      updated_at: new Date().toISOString(),
    });
    return nextEpoch;
  }
  await writeKey(
    kv,
    `pin_epoch:${branchId}`,
    JSON.stringify({ date: dateStr, epoch: nextEpoch }),
    36 * 60 * 60
  );
  return nextEpoch;
}

export async function getLeaderPinEpoch(branchId: string, store?: StoreRef): Promise<number> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ leader_pin_epoch: number }>(
      'groups',
      `id=eq.${encodeURIComponent(branchId)}&select=leader_pin_epoch&limit=1`
    );
    return Math.max(0, Math.floor(Number(rows[0]?.leader_pin_epoch) || 0));
  }
  const raw = await readKey(kv, `leader_epoch:${branchId}`);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export async function getLeaderPinEpochs(store?: StoreRef): Promise<Record<BranchId, number>> {
  const { db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ id: string; leader_pin_epoch: number }>(
      'groups',
      'select=id,leader_pin_epoch'
    );
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const out = {} as Record<BranchId, number>;
    for (const branchId of BRANCH_IDS) {
      out[branchId] = Math.max(0, Math.floor(Number(rowMap.get(branchId)?.leader_pin_epoch) || 0));
    }
    return out;
  }
  const entries = await Promise.all(
    BRANCH_IDS.map(async (b) => [b, await getLeaderPinEpoch(b, store)] as const)
  );
  return Object.fromEntries(entries) as Record<BranchId, number>;
}

export async function rotateLeaderPinEpoch(branchId: string, store?: StoreRef): Promise<number> {
  const { kv, db } = splitBackend(store);
  const current = await getLeaderPinEpoch(branchId, store);
  const nextEpoch = current + 1;
  if (db) {
    await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
      leader_pin_epoch: nextEpoch,
      updated_at: new Date().toISOString(),
    });
    return nextEpoch;
  }
  await writeKey(kv, `leader_epoch:${branchId}`, String(nextEpoch));
  return nextEpoch;
}

export async function getGroupNames(
  store?: StoreRef
): Promise<Partial<Record<BranchId, string>>> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ id: string; custom_name: string | null }>(
      'groups',
      'select=id,custom_name'
    );
    const result: Partial<Record<BranchId, string>> = {};
    for (const r of rows) {
      if ((BRANCH_IDS as readonly string[]).includes(r.id) && typeof r.custom_name === 'string' && r.custom_name.trim()) {
        result[r.id as BranchId] = r.custom_name.trim();
      }
    }
    return result;
  }
  const raw = await readJson<Record<string, unknown> | null>(kv, KEY_GROUP_NAMES, null);
  if (!raw || typeof raw !== 'object') return {};
  const result: Partial<Record<BranchId, string>> = {};
  for (const branchId of BRANCH_IDS) {
    const val = raw[branchId];
    if (typeof val === 'string' && val.trim()) {
      result[branchId] = val.trim();
    }
  }
  return result;
}

export async function setGroupName(
  branchId: BranchId,
  name: string,
  store?: StoreRef
): Promise<Partial<Record<BranchId, string>>> {
  const { kv, db } = splitBackend(store);
  const cleanName = name.trim();
  if (db) {
    await db.patch('groups', `id=eq.${encodeURIComponent(branchId)}`, {
      custom_name: cleanName || null,
      updated_at: new Date().toISOString(),
    });
    return getGroupNames(store);
  }
  const current = await getGroupNames(store);
  if (cleanName) {
    current[branchId] = cleanName;
  } else {
    delete current[branchId];
  }
  await writeKey(kv, KEY_GROUP_NAMES, JSON.stringify(current));
  return current;
}

export async function getConfiguredWebhookUrl(
  envWebhook: string | undefined,
  store?: StoreRef
): Promise<string | null> {
  const { kv, db } = splitBackend(store);
  if (db) {
    const rows = await db.select<{ value: string }>('app_settings', `key=eq.${KEY_WEBHOOK}&limit=1`);
    const stored = rows[0]?.value;
    if (stored && stored.trim()) return stored.trim();
    if (envWebhook && envWebhook.trim()) return envWebhook.trim();
    return null;
  }
  const stored = await readKey(kv, KEY_WEBHOOK);
  if (stored && stored.trim()) return stored.trim();
  if (envWebhook && envWebhook.trim()) return envWebhook.trim();
  return null;
}

export async function setStoredWebhookUrl(url: string, store?: StoreRef): Promise<void> {
  const { kv, db } = splitBackend(store);
  if (db) {
    await db.upsert(
      'app_settings',
      [{ key: KEY_WEBHOOK, value: url.trim(), updated_at: new Date().toISOString() }],
      'key'
    );
    return;
  }
  await writeKey(kv, KEY_WEBHOOK, url.trim());
}

export function maskWebhookUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const webhookId = segments[2] ?? '';
    return `https://${parsed.hostname}/api/webhooks/${webhookId}/••••`;
  } catch {
    return 'https://discord.com/api/webhooks/••••';
  }
}

export async function sendDiscordSecurityAlert(
  webhookUrl: string | null,
  log: ServerIpLogEntry
): Promise<void> {
  if (!webhookUrl) return;
  const isDanger = log.event === 'failed_pin' || log.event === 'banned_attempt' || log.event === 'pin_rotated' || log.event === 'leader_rotated';
  const titleMap: Record<ServerIpLogEntry['event'], string> = {
    visit: '👀 มีคนเปิดดูหน้าเว็บแผนที่',
    login: '✅ ยืนยันตัวตนเข้าแผนที่สำเร็จ',
    failed_pin: '🚨 ใส่รหัส PIN ผิดพลาด',
    banned_attempt: '⛔ บล็อก IP ที่ถูกแบนไม่ให้เข้าใช้งาน',
    pin_rotated: '🔄 รีเซ็ตรหัสผ่านสมาชิกกลุ่มใหม่',
    leader_rotated: '👑 รีเซ็ตรหัสหัวหน้ากลุ่มใหม่',
  };

  const payload = {
    username: 'Cement Map Security',
    embeds: [
      {
        title: titleMap[log.event],
        color: isDanger ? 0xef4444 : log.event === 'login' ? 0x10b981 : 0x3b82f6,
        fields: [
          { name: 'สมาชิก / ชื่อ', value: log.memberName || 'ไม่ระบุ', inline: true },
          { name: 'กลุ่ม', value: log.branchId || 'ไม่ระบุ', inline: true },
          { name: 'IP Address', value: `\`${log.ip}\``, inline: true },
          {
            name: 'พิกัดคร่าวๆ',
            value: [log.city, log.country].filter(Boolean).join(', ') || 'Unknown',
            inline: true,
          },
          { name: 'User Agent', value: `\`${log.userAgent.slice(0, 120)}\``, inline: false },
        ],
        timestamp: new Date(log.timestamp).toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort security telemetry should never crash auth requests.
  }
}
