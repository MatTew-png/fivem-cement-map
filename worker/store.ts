export interface KvStoreLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface ServerIpLogEntry {
  id: string;
  ip: string;
  memberName: string;
  branchId: string;
  event: 'visit' | 'login' | 'failed_pin' | 'banned_attempt';
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

export async function getBanList(kv?: KvStoreLike): Promise<ServerBanEntry[]> {
  const bans = await readJson<ServerBanEntry[]>(kv, KEY_BANS, []);
  return Array.isArray(bans) ? bans : [];
}

export async function findBanByIp(ip: string, kv?: KvStoreLike): Promise<ServerBanEntry | null> {
  if (!ip || ip === 'unknown') return null;
  const bans = await getBanList(kv);
  return bans.find((entry) => entry.ip === ip) ?? null;
}

export async function addBan(
  ip: string,
  reason: string,
  bannedBy: string,
  kv?: KvStoreLike
): Promise<ServerBanEntry[]> {
  const bans = await getBanList(kv);
  const filtered = bans.filter((entry) => entry.ip !== ip);
  const next: ServerBanEntry[] = [
    { ip, reason, bannedAt: Date.now(), bannedBy },
    ...filtered,
  ];
  await writeKey(kv, KEY_BANS, JSON.stringify(next));
  return next;
}

export async function removeBan(ip: string, kv?: KvStoreLike): Promise<ServerBanEntry[]> {
  const bans = await getBanList(kv);
  const next = bans.filter((entry) => entry.ip !== ip);
  await writeKey(kv, KEY_BANS, JSON.stringify(next));
  return next;
}

export async function getSecurityLogs(kv?: KvStoreLike): Promise<ServerIpLogEntry[]> {
  const logs = await readJson<ServerIpLogEntry[]>(kv, KEY_LOGS, []);
  return Array.isArray(logs) ? logs : [];
}

export async function appendSecurityLog(
  entry: Omit<ServerIpLogEntry, 'id' | 'timestamp'>,
  kv?: KvStoreLike
): Promise<ServerIpLogEntry> {
  const logs = await getSecurityLogs(kv);
  const fullEntry: ServerIpLogEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const next = [fullEntry, ...logs].slice(0, MAX_LOG_ENTRIES);
  await writeKey(kv, KEY_LOGS, JSON.stringify(next));
  return fullEntry;
}

export async function getRateLimitStatus(
  ip: string,
  kv?: KvStoreLike,
  nowMs = Date.now()
): Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const key = `security:rl:${ip}`;
  const state = await readJson<RateLimitState | null>(kv, key, null);
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
  kv?: KvStoreLike,
  nowMs = Date.now()
): Promise<{ locked: boolean; retryAfterSec: number; remainingAttempts: number }> {
  const key = `security:rl:${ip}`;
  const prev = await readJson<RateLimitState | null>(kv, key, null);

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

  await writeKey(kv, key, JSON.stringify(nextState), 30 * 60);

  return {
    locked: nextState.lockedUntil > nowMs,
    retryAfterSec:
      nextState.lockedUntil > nowMs
        ? Math.ceil((nextState.lockedUntil - nowMs) / 1000)
        : 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextState.attempts),
  };
}

export async function clearRateLimit(ip: string, kv?: KvStoreLike): Promise<void> {
  const key = `security:rl:${ip}`;
  await writeKey(
    kv,
    key,
    JSON.stringify({ attempts: 0, windowStart: Date.now(), lockedUntil: 0 }),
    60
  );
}

export async function getForceLogoutAfter(kv?: KvStoreLike): Promise<number> {
  const raw = await readKey(kv, KEY_FORCE_LOGOUT);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setForceLogoutAfter(timestampMs: number, kv?: KvStoreLike): Promise<void> {
  await writeKey(kv, KEY_FORCE_LOGOUT, String(timestampMs));
}

export async function getConfiguredWebhookUrl(
  envWebhook: string | undefined,
  kv?: KvStoreLike
): Promise<string | null> {
  const stored = await readKey(kv, KEY_WEBHOOK);
  if (stored && stored.trim()) return stored.trim();
  if (envWebhook && envWebhook.trim()) return envWebhook.trim();
  return null;
}

export async function setStoredWebhookUrl(url: string, kv?: KvStoreLike): Promise<void> {
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
  const isDanger = log.event === 'failed_pin' || log.event === 'banned_attempt';
  const titleMap: Record<ServerIpLogEntry['event'], string> = {
    visit: '👀 มีคนเปิดดูหน้าเว็บแผนที่',
    login: '✅ ยืนยันตัวตนเข้าแผนที่สำเร็จ',
    failed_pin: '🚨 ใส่รหัส PIN ผิดพลาด',
    banned_attempt: '⛔ บล็อก IP ที่ถูกแบนไม่ให้เข้าใช้งาน',
  };

  const payload = {
    username: 'Cement Map Security',
    embeds: [
      {
        title: titleMap[log.event],
        color: isDanger ? 0xef4444 : log.event === 'login' ? 0x10b981 : 0x3b82f6,
        fields: [
          { name: 'สมาชิก / ชื่อ', value: log.memberName || 'ไม่ระบุ', inline: true },
          { name: 'สาขา', value: log.branchId || 'ไม่ระบุ', inline: true },
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
