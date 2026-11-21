import {
  BRANCH_NAMES,
  MASTER_GANG_ID,
  buildApiHeaders,
  deriveAllBranchDailyPins,
  deriveAllLeaderPins,
  deriveDailyChannelKey,
  extractClientIp,
  getBangkokDateString,
  getUpcomingBangkokDates,
  hashIdentifier,
  isOriginAllowed,
  isValidBranchId,
  isValidDiscordWebhookUrl,
  resolvePayloadRole,
  resolvePinCredentials,
  sanitizeText,
  signSessionToken,
  verifySessionToken,
  type BranchId,
  type SessionTokenPayload,
  type UserRole,
} from './authCore.ts';
import {
  addBan,
  appendSecurityLog,
  clearRateLimit,
  findBanByIp,
  getBanList,
  getBranchLeaderForceLogoutAfter,
  getBranchMemberForceLogoutAfter,
  getConfiguredWebhookUrl,
  getForceLogoutAfter,
  getGroupNames,
  getLeaderPinEpoch,
  getLeaderPinEpochs,
  getMemberPinEpoch,
  getMemberPinEpochs,
  getRateLimitStatus,
  getSecurityLogs,
  maskWebhookUrl,
  recordFailedAttempt,
  removeBan,
  rotateLeaderPinEpoch,
  rotateMemberPinEpoch,
  sendDiscordSecurityAlert,
  setBranchLeaderForceLogoutAfter,
  setBranchMemberForceLogoutAfter,
  setForceLogoutAfter,
  setGroupName,
  setStoredWebhookUrl,
  type KvStoreLike,
  type StoreRef,
} from './store.ts';
import { SupabaseRestClient } from './supabaseRest.ts';
import {
  appendActivityLogInDb,
  clearActivityLogsInDb,
  deleteCooldownInDb,
  deleteSpotInDb,
  getMapStateFromDb,
  replaceSpotsWithBackupInDb,
  seedBranchSpotsInDb,
  upsertCooldownInDb,
  upsertSpotInDb,
  type StoredActivityLog,
  type StoredCooldown,
  type StoredSpot,
} from './mapDb.ts';

export interface WorkerEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  GANG_VAULT?: KvStoreLike;
  MASTER_PIN?: string;
  GANG_SECRET_SEED?: string;
  SESSION_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_SUPABASE_URL = 'https://ibtamnpkagjmnlzuejju.supabase.co';

function getSupabaseCredentials(env: WorkerEnv): { url: string; serviceRoleKey: string } | undefined {
  const url = env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceRoleKey) {
    return { url, serviceRoleKey };
  }
  return undefined;
}

function getStoreRef(env: WorkerEnv): StoreRef {
  return {
    kv: env.GANG_VAULT,
    db: getSupabaseCredentials(env),
  };
}

function getMapDb(env: WorkerEnv): SupabaseRestClient | null {
  const creds = getSupabaseCredentials(env);
  return creds ? new SupabaseRestClient(creds) : null;
}

function resolveTargetBranchForMap(
  role: UserRole,
  payloadSub: string,
  requestedBranch?: string
): string | null {
  if (role === 'super_admin') {
    const candidate = sanitizeText(requestedBranch, 24) || 'branch_1';
    return isValidBranchId(candidate) ? candidate : null;
  }
  if (requestedBranch && requestedBranch !== payloadSub) {
    return null;
  }
  return isValidBranchId(payloadSub) ? payloadSub : null;
}

export interface ExecutionCtxLike {
  waitUntil(promise: Promise<unknown>): void;
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, ...extraHeaders },
  });
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function extractBearerToken(request: Request): string {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

function getSessionSecret(env: WorkerEnv): string {
  return (env.SESSION_SECRET || env.GANG_SECRET_SEED || '').trim();
}

async function authenticateRequest(
  request: Request,
  env: WorkerEnv
): Promise<SessionTokenPayload | null> {
  const token = extractBearerToken(request);
  const secret = getSessionSecret(env);
  if (!token || !secret) return null;

  const storeRef = getStoreRef(env);
  const forceLogoutAfter = await getForceLogoutAfter(storeRef);
  const payload = await verifySessionToken(token, secret, { forceLogoutAfter });
  if (!payload) return null;

  const role = resolvePayloadRole(payload);
  if (role === 'member' && isValidBranchId(payload.sub)) {
    const todayStr = getBangkokDateString();
    const [memberAfter, currentEpoch] = await Promise.all([
      getBranchMemberForceLogoutAfter(payload.sub, storeRef),
      getMemberPinEpoch(payload.sub, todayStr, storeRef),
    ]);
    if (payload.iat < memberAfter || (payload.pinEpoch ?? 0) !== currentEpoch) {
      return null;
    }
  } else if (role === 'group_leader' && isValidBranchId(payload.sub)) {
    const [leaderAfter, currentLeaderEpoch] = await Promise.all([
      getBranchLeaderForceLogoutAfter(payload.sub, storeRef),
      getLeaderPinEpoch(payload.sub, storeRef),
    ]);
    if (payload.iat < leaderAfter || (payload.pinEpoch ?? 0) !== currentLeaderEpoch) {
      return null;
    }
  }

  return payload;
}

function filterGroupNamesForRole(
  groupNames: Partial<Record<BranchId, string>>,
  role: UserRole,
  branchId: string
): Partial<Record<BranchId, string>> {
  if (role === 'super_admin') return groupNames;
  if (isValidBranchId(branchId)) {
    const custom = groupNames[branchId as BranchId];
    return custom ? { [branchId]: custom } : {};
  }
  return {};
}

function resolvePublicGangName(
  role: UserRole,
  branchId: string,
  groupNames: Partial<Record<BranchId, string>>
): string {
  if (role === 'super_admin') {
    return BRANCH_NAMES[MASTER_GANG_ID] ?? 'Master Boss';
  }
  if (isValidBranchId(branchId)) {
    const custom = groupNames[branchId as BranchId];
    if (custom) return custom;
  }
  return role === 'group_leader' ? 'หัวหน้ากลุ่ม' : 'แผนที่กลุ่ม';
}

async function buildPinDashboardData(
  secretSeed: string,
  masterPin: string,
  role: UserRole,
  branchId: string,
  kv?: StoreRef
) {
  const todayStr = getBangkokDateString();
  const [leaderEpochs, memberEpochs, groupNames] = await Promise.all([
    getLeaderPinEpochs(kv),
    getMemberPinEpochs(todayStr, kv),
    getGroupNames(kv),
  ]);
  const leaderPins = await deriveAllLeaderPins(secretSeed, leaderEpochs, new Set([masterPin]));
  const reservedPins = new Set<string>([masterPin, ...Object.values(leaderPins)]);
  const dates = getUpcomingBangkokDates(7);

  const schedule = await Promise.all(
    dates.map(async (date) => {
      const allPins = await deriveAllBranchDailyPins(secretSeed, date, {
        memberEpochs: date === todayStr ? memberEpochs : undefined,
        reservedPins,
      });
      if (role === 'super_admin') {
        return { date, pins: allPins };
      }
      return {
        date,
        pins: isValidBranchId(branchId) ? { [branchId]: allPins[branchId as BranchId] } : {},
      };
    })
  );

  const scopedGroupNames = filterGroupNamesForRole(groupNames, role, branchId);
  if (role === 'super_admin') {
    return { schedule, leaderPins, memberEpochs, leaderEpochs, groupNames: scopedGroupNames };
  }
  return {
    schedule,
    memberEpoch: isValidBranchId(branchId) ? memberEpochs[branchId as BranchId] : 0,
    groupNames: scopedGroupNames,
  };
}

function isValidIpFormat(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed || trimmed === 'unknown' || trimmed.length > 64) return false;
  return /^[0-9a-fA-F:.]+$/.test(trimmed);
}

export async function handleApiRequest(
  request: Request,
  env: WorkerEnv,
  ctx?: ExecutionCtxLike
): Promise<Response> {
  const url = new URL(request.url);
  const headers = buildApiHeaders(request, env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin');

  if (!isOriginAllowed(origin, url, env.ALLOWED_ORIGINS)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const kv = getStoreRef(env);
  const hasSupabaseDb = Boolean(getSupabaseCredentials(env));
  const clientIp = extractClientIp(request);
  const city = sanitizeText(request.headers.get('cf-ipcity'), 64);
  const country = sanitizeText(request.headers.get('cf-ipcountry') || 'TH', 8);
  const userAgent = sanitizeText(request.headers.get('user-agent') || 'Unknown', 160);

  const scheduleAlert = (promise: Promise<unknown>) => {
    if (ctx) {
      ctx.waitUntil(promise);
    }
  };

  if (url.pathname === '/api/health' && request.method === 'GET') {
    return jsonResponse(
      {
        ok: true,
        service: 'runthukverb-cement-cooldown',
        configured: Boolean(env.MASTER_PIN?.trim() && env.GANG_SECRET_SEED?.trim()),
        kvBound: Boolean(env.GANG_VAULT),
        supabaseConfigured: hasSupabaseDb,
        storage: hasSupabaseDb ? 'supabase-postgres' : env.GANG_VAULT ? 'cloudflare-kv' : 'memory',
        realtime: 'supabase-realtime',
        date: getBangkokDateString(),
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/my-ip' && request.method === 'GET') {
    const ban = await findBanByIp(clientIp, kv);
    return jsonResponse(
      {
        ip: clientIp,
        city,
        country,
        banned: Boolean(ban),
        banReason: ban?.reason ?? null,
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/verify' && request.method === 'POST') {
    const masterPin = env.MASTER_PIN?.trim() ?? '';
    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    if (!masterPin || !secretSeed) {
      return jsonResponse(
        {
          success: false,
          error:
            'ระบบหลังบ้านยังไม่ได้ตั้งค่า MASTER_PIN หรือ GANG_SECRET_SEED (wrangler secret put)',
        },
        503,
        headers
      );
    }

    const ban = await findBanByIp(clientIp, kv);
    if (ban) {
      const log = await appendSecurityLog(
        {
          ip: clientIp,
          memberName: 'Banned User',
          branchId: 'blocked',
          event: 'banned_attempt',
          country,
          city,
          userAgent,
        },
        kv
      );
      const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
      scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));
      return jsonResponse(
        {
          success: false,
          banned: true,
          error: `IP ของคุณถูกระงับการใช้งาน (${ban.reason})`,
        },
        403,
        headers
      );
    }

    const rateStatus = await getRateLimitStatus(clientIp, kv);
    if (rateStatus.locked) {
      return jsonResponse(
        {
          success: false,
          locked: true,
          retryAfterSec: rateStatus.retryAfterSec,
          error: `ใส่รหัสผิดเกินกำหนด กรุณารอ ${Math.ceil(rateStatus.retryAfterSec / 60)} นาที`,
        },
        429,
        headers,
        { 'Retry-After': String(rateStatus.retryAfterSec) }
      );
    }

    const body = await parseJsonBody<{
      pin?: string;
      branchId?: string;
      memberName?: string;
    }>(request);
    if (!body) {
      return jsonResponse({ success: false, error: 'รูปแบบคำขอ JSON ไม่ถูกต้อง' }, 400, headers);
    }

    const memberName = sanitizeText(body.memberName, 32);
    const pin = sanitizeText(body.pin, 32);
    const requestedBranch = sanitizeText(body.branchId, 24);

    if (!memberName) {
      return jsonResponse({ success: false, error: 'กรุณาระบุชื่อเล่นในกลุ่ม' }, 400, headers);
    }
    if (!pin) {
      return jsonResponse({ success: false, error: 'กรุณากรอกรหัสผ่าน' }, 400, headers);
    }

    if (requestedBranch && !isValidBranchId(requestedBranch)) {
      return jsonResponse({ success: false, error: 'รหัสผ่านหรือกลุ่มไม่ถูกต้อง' }, 400, headers);
    }

    const todayStr = getBangkokDateString();
    const [leaderEpochs, memberEpochs] = await Promise.all([
      getLeaderPinEpochs(kv),
      getMemberPinEpochs(todayStr, kv),
    ]);
    const credentials = await resolvePinCredentials({
      masterPin,
      secretSeed,
      inputPin: pin,
      dateStr: todayStr,
      leaderEpochs,
      memberEpochs,
      requestedBranchId: requestedBranch || undefined,
    });

    if (!credentials) {
      const nextRate = await recordFailedAttempt(clientIp, kv);
      const log = await appendSecurityLog(
        {
          ip: clientIp,
          memberName,
          branchId: requestedBranch || 'auto',
          event: 'failed_pin',
          country,
          city,
          userAgent,
        },
        kv
      );
      const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
      scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));

      if (nextRate.locked) {
        return jsonResponse(
          {
            success: false,
            locked: true,
            remainingAttempts: 0,
            retryAfterSec: nextRate.retryAfterSec,
            error: `ใส่รหัสผิดครบ 5 ครั้ง ล็อกระบบชั่วคราว ${Math.ceil(nextRate.retryAfterSec / 60)} นาที`,
          },
          429,
          headers,
          { 'Retry-After': String(nextRate.retryAfterSec) }
        );
      }

      return jsonResponse(
        {
          success: false,
          remainingAttempts: nextRate.remainingAttempts,
          error: `รหัสผ่านไม่ถูกต้อง (เหลือโอกาส ${nextRate.remainingAttempts} ครั้ง)`,
        },
        401,
        headers
      );
    }

    await clearRateLimit(clientIp, kv);

    const role: UserRole = credentials.role;
    const isMaster = role === 'super_admin';
    const gangId = credentials.branchId;
    const groupNames = await getGroupNames(kv);
    const gangName = resolvePublicGangName(role, gangId, groupNames);
    const scopedGroupNames = filterGroupNamesForRole(groupNames, role, gangId);
    const nowMs = Date.now();
    const sessionSecret = getSessionSecret(env);
    const ipHash = await hashIdentifier(sessionSecret, clientIp);
    const payload: SessionTokenPayload = {
      sub: gangId,
      gangName,
      memberName,
      authDate: todayStr,
      isMaster,
      role,
      pinEpoch: credentials.pinEpoch,
      iat: nowMs,
      exp: nowMs + 24 * 60 * 60 * 1000,
      ipHash,
    };

    const [token, channelKey] = await Promise.all([
      signSessionToken(payload, sessionSecret),
      deriveDailyChannelKey(secretSeed, todayStr),
    ]);

    const log = await appendSecurityLog(
      {
        ip: clientIp,
        memberName,
        branchId: gangId,
        event: 'login',
        country,
        city,
        userAgent,
      },
      kv
    );
    const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
    scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));

    return jsonResponse(
      {
        success: true,
        token,
        channelKey,
        groupNames: scopedGroupNames,
        session: {
          gangId,
          gangName,
          memberName,
          authDate: todayStr,
          authenticatedAt: nowMs,
          isMaster,
          role,
          groupNames: scopedGroupNames,
          token,
          channelKey,
        },
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const ban = await findBanByIp(clientIp, kv);
    if (ban) {
      return jsonResponse(
        { valid: false, banned: true, banReason: ban.reason },
        403,
        headers
      );
    }

    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ valid: false }, 401, headers);
    }

    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    const todayStr = getBangkokDateString();
    const [channelKey, groupNames] = await Promise.all([
      secretSeed ? deriveDailyChannelKey(secretSeed, todayStr) : Promise.resolve(undefined),
      getGroupNames(kv),
    ]);
    const role = resolvePayloadRole(payload);
    const freshGangName = resolvePublicGangName(role, payload.sub, groupNames);
    const scopedGroupNames = filterGroupNamesForRole(groupNames, role, payload.sub);

    return jsonResponse(
      {
        valid: true,
        channelKey,
        groupNames: scopedGroupNames,
        session: {
          gangId: payload.sub,
          gangName: freshGangName,
          memberName: payload.memberName,
          authDate: payload.authDate,
          authenticatedAt: payload.iat,
          isMaster: payload.isMaster,
          role,
          groupNames: scopedGroupNames,
          channelKey,
        },
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/pins/upcoming' && request.method === 'GET') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    if (role === 'member') {
      return jsonResponse({ error: 'Forbidden: Leader or Master access only' }, 403, headers);
    }

    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    const masterPin = env.MASTER_PIN?.trim() ?? '';
    if (!secretSeed || !masterPin) {
      return jsonResponse({ error: 'Auth secrets are not configured' }, 503, headers);
    }

    const data = await buildPinDashboardData(secretSeed, masterPin, role, payload.sub, kv);
    return jsonResponse(data, 200, headers);
  }

  if (url.pathname === '/api/pins/rotate-member' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    if (role === 'member') {
      return jsonResponse({ error: 'Forbidden: Leader or Master access only' }, 403, headers);
    }

    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    const masterPin = env.MASTER_PIN?.trim() ?? '';
    if (!secretSeed || !masterPin) {
      return jsonResponse({ error: 'Auth secrets are not configured' }, 503, headers);
    }

    const body = await parseJsonBody<{ branchId?: string }>(request);
    const requested = sanitizeText(body?.branchId, 24);
    const targetBranch = role === 'super_admin' ? requested : payload.sub;

    if (role === 'group_leader' && requested && requested !== payload.sub) {
      return jsonResponse({ error: 'Forbidden: Cannot rotate another group PIN' }, 403, headers);
    }
    if (!isValidBranchId(targetBranch)) {
      return jsonResponse({ error: 'กรุณาระบุกลุ่มที่ต้องการรีเซ็ตรหัส' }, 400, headers);
    }

    const todayStr = getBangkokDateString();
    const nextEpoch = await rotateMemberPinEpoch(targetBranch, todayStr, kv);
    await setBranchMemberForceLogoutAfter(targetBranch, Date.now(), kv);

    const log = await appendSecurityLog(
      {
        ip: clientIp,
        memberName: payload.memberName,
        branchId: targetBranch,
        event: 'pin_rotated',
        country,
        city,
        userAgent,
      },
      kv
    );
    const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
    scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));

    const dashboardData = await buildPinDashboardData(secretSeed, masterPin, role, targetBranch, kv);
    const todayPins = dashboardData.schedule[0]?.pins as Record<string, string> | undefined;
    const newTodayPin = todayPins?.[targetBranch] ?? '';
    return jsonResponse(
      {
        ok: true,
        branchId: targetBranch,
        memberEpoch: nextEpoch,
        newTodayPin,
        ...dashboardData,
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/pins/rotate-leader' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    if (role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden: Master access only' }, 403, headers);
    }

    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    const masterPin = env.MASTER_PIN?.trim() ?? '';
    if (!secretSeed || !masterPin) {
      return jsonResponse({ error: 'Auth secrets are not configured' }, 503, headers);
    }

    const body = await parseJsonBody<{ branchId?: string }>(request);
    const targetBranch = sanitizeText(body?.branchId, 24);
    if (!isValidBranchId(targetBranch)) {
      return jsonResponse({ error: 'กรุณาระบุกลุ่มที่ต้องการรีเซ็ตรหัสหัวหน้า' }, 400, headers);
    }

    const nextLeaderEpoch = await rotateLeaderPinEpoch(targetBranch, kv);
    await setBranchLeaderForceLogoutAfter(targetBranch, Date.now(), kv);

    const log = await appendSecurityLog(
      {
        ip: clientIp,
        memberName: payload.memberName,
        branchId: targetBranch,
        event: 'leader_rotated',
        country,
        city,
        userAgent,
      },
      kv
    );
    const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
    scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));

    const dashboardData = await buildPinDashboardData(secretSeed, masterPin, role, targetBranch, kv);
    return jsonResponse(
      {
        ok: true,
        branchId: targetBranch,
        leaderEpoch: nextLeaderEpoch,
        newLeaderPin: dashboardData.leaderPins?.[targetBranch as BranchId] ?? '',
        ...dashboardData,
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/group/rename' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    if (role === 'member') {
      return jsonResponse({ error: 'Forbidden: Leader or Master access only' }, 403, headers);
    }

    const body = await parseJsonBody<{ branchId?: string; name?: string }>(request);
    if (!body || typeof body.name !== 'string') {
      return jsonResponse({ error: 'กรุณาระบุชื่อกลุ่ม' }, 400, headers);
    }

    const requestedBranch = sanitizeText(body.branchId, 24);
    if (role === 'group_leader' && requestedBranch && requestedBranch !== payload.sub) {
      return jsonResponse({ error: 'Forbidden: Cannot rename another group' }, 403, headers);
    }

    const targetBranch = role === 'super_admin' ? requestedBranch : payload.sub;
    if (!isValidBranchId(targetBranch)) {
      return jsonResponse({ error: 'ไม่พบกลุ่มที่ต้องการตั้งชื่อ' }, 400, headers);
    }

    const cleanName = sanitizeText(body.name, 28);
    const updatedNames = await setGroupName(targetBranch as BranchId, cleanName, kv);
    return jsonResponse(
      {
        ok: true,
        branchId: targetBranch,
        name: cleanName,
        groupNames: filterGroupNamesForRole(updatedNames, role, targetBranch),
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/security/visit' && request.method === 'POST') {
    const body = (await parseJsonBody<{ memberName?: string; branchId?: string }>(request)) ?? {};
    const memberName = sanitizeText(body.memberName || 'Guest', 32) || 'Guest';
    const branchId = sanitizeText(body.branchId || 'unauthenticated', 24) || 'unauthenticated';

    const ban = await findBanByIp(clientIp, kv);
    if (ban) {
      const log = await appendSecurityLog(
        {
          ip: clientIp,
          memberName,
          branchId,
          event: 'banned_attempt',
          country,
          city,
          userAgent,
        },
        kv
      );
      const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
      scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));
      return jsonResponse(
        { banned: true, banReason: ban.reason, ip: clientIp, city, country },
        403,
        headers
      );
    }

    const log = await appendSecurityLog(
      {
        ip: clientIp,
        memberName,
        branchId,
        event: 'visit',
        country,
        city,
        userAgent,
      },
      kv
    );
    const webhookUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
    scheduleAlert(sendDiscordSecurityAlert(webhookUrl, log));

    return jsonResponse({ banned: false, ip: clientIp, city, country }, 200, headers);
  }

  if (url.pathname === '/api/security/logs' && request.method === 'GET') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const [logs, bans, webhookUrl] = await Promise.all([
      getSecurityLogs(kv),
      getBanList(kv),
      getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv),
    ]);

    return jsonResponse(
      {
        logs,
        bans,
        webhookConfigured: Boolean(webhookUrl),
        webhookMasked: maskWebhookUrl(webhookUrl),
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/security/ban' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const body = await parseJsonBody<{ ip?: string; reason?: string }>(request);
    const ip = sanitizeText(body?.ip, 64);
    if (!isValidIpFormat(ip)) {
      return jsonResponse({ error: 'รูปแบบ IP ไม่ถูกต้อง' }, 400, headers);
    }
    const reason = sanitizeText(body?.reason || 'ถูกแบนโดย Master Boss', 120) || 'ถูกแบนโดย Master Boss';
    const bans = await addBan(ip, reason, payload.memberName, kv);
    return jsonResponse({ ok: true, bans }, 200, headers);
  }

  if (url.pathname === '/api/security/unban' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const body = await parseJsonBody<{ ip?: string }>(request);
    const ip = sanitizeText(body?.ip, 64);
    if (!isValidIpFormat(ip)) {
      return jsonResponse({ error: 'รูปแบบ IP ไม่ถูกต้อง' }, 400, headers);
    }
    const bans = await removeBan(ip, kv);
    return jsonResponse({ ok: true, bans }, 200, headers);
  }

  if (url.pathname === '/api/security/webhook' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const body = await parseJsonBody<{ webhookUrl?: string }>(request);
    if (!body || typeof body.webhookUrl !== 'string') {
      return jsonResponse({ error: 'กรุณาระบุ webhookUrl' }, 400, headers);
    }

    const nextUrl = body.webhookUrl.trim();
    if (nextUrl && !isValidDiscordWebhookUrl(nextUrl)) {
      return jsonResponse(
        { error: 'URL ต้องเป็น https://discord.com/api/webhooks/...' },
        400,
        headers
      );
    }

    await setStoredWebhookUrl(nextUrl, kv);
    const activeUrl = await getConfiguredWebhookUrl(env.DISCORD_WEBHOOK_URL, kv);
    return jsonResponse(
      {
        ok: true,
        webhookConfigured: Boolean(activeUrl),
        webhookMasked: maskWebhookUrl(activeUrl),
      },
      200,
      headers
    );
  }

  if (url.pathname === '/api/admin/force-logout' && request.method === 'POST') {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    if (role === 'member') {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const body = await parseJsonBody<{ branchId?: string }>(request);
    const requestedBranch = sanitizeText(body?.branchId, 24);
    const forceLogoutAfter = Date.now();

    if (role === 'group_leader') {
      if (requestedBranch && requestedBranch !== payload.sub) {
        return jsonResponse({ error: 'Forbidden: Cannot kick another group' }, 403, headers);
      }
      if (!isValidBranchId(payload.sub)) {
        return jsonResponse({ error: 'Invalid branch context' }, 400, headers);
      }
      await setBranchMemberForceLogoutAfter(payload.sub, forceLogoutAfter, kv);
      return jsonResponse({ ok: true, branchId: payload.sub, forceLogoutAfter }, 200, headers);
    }

    if (requestedBranch && isValidBranchId(requestedBranch)) {
      await setBranchMemberForceLogoutAfter(requestedBranch, forceLogoutAfter, kv);
      return jsonResponse({ ok: true, branchId: requestedBranch, forceLogoutAfter }, 200, headers);
    }

    await setForceLogoutAfter(forceLogoutAfter, kv);
    return jsonResponse({ ok: true, forceLogoutAfter }, 200, headers);
  }

  // Persistent Map Data Endpoints backed by Supabase Postgres
  if (url.pathname.startsWith('/api/map/')) {
    const payload = await authenticateRequest(request, env);
    if (!payload) {
      return jsonResponse({ error: 'Unauthorized' }, 401, headers);
    }
    const role = resolvePayloadRole(payload);
    const mapDb = getMapDb(env);

    if (url.pathname === '/api/map/state' && request.method === 'GET') {
      const requestedBranch = sanitizeText(url.searchParams.get('branchId'), 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch) {
        return jsonResponse({ error: 'Forbidden' }, 403, headers);
      }
      if (!mapDb) {
        return jsonResponse({ enabled: false }, 200, headers);
      }
      const state = await getMapStateFromDb(mapDb, targetBranch);
      return jsonResponse({ enabled: true, branchId: targetBranch, ...state }, 200, headers);
    }

    if (!mapDb) {
      return jsonResponse({ ok: true, enabled: false }, 200, headers);
    }

    if (url.pathname === '/api/map/seed' && request.method === 'POST') {
      const body = await parseJsonBody<{ spots?: StoredSpot[]; replace?: boolean; branchId?: string }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch) {
        return jsonResponse({ error: 'Forbidden' }, 403, headers);
      }
      const replace = Boolean(body?.replace) && role === 'super_admin';
      const spots = Array.isArray(body?.spots) ? body.spots : [];
      const res = await seedBranchSpotsInDb(mapDb, targetBranch, spots, replace);
      return jsonResponse({ ok: true, enabled: true, ...res }, 200, headers);
    }

    if (url.pathname === '/api/map/spots' && request.method === 'POST') {
      const body = await parseJsonBody<{ spot?: StoredSpot; branchId?: string }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch || !body?.spot) {
        return jsonResponse({ error: !targetBranch ? 'Forbidden' : 'Missing spot' }, !targetBranch ? 403 : 400, headers);
      }
      const saved = await upsertSpotInDb(mapDb, targetBranch, body.spot);
      return jsonResponse({ ok: true, spot: saved }, 200, headers);
    }

    if (url.pathname === '/api/map/spots/delete' && request.method === 'POST') {
      const body = await parseJsonBody<{ spotId?: string; branchId?: string }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const spotId = sanitizeText(body?.spotId, 80);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch || !spotId) {
        return jsonResponse({ error: !targetBranch ? 'Forbidden' : 'Missing spotId' }, !targetBranch ? 403 : 400, headers);
      }
      await deleteSpotInDb(mapDb, targetBranch, spotId);
      return jsonResponse({ ok: true }, 200, headers);
    }

    if (url.pathname === '/api/map/spots/bulk' && request.method === 'POST') {
      const body = await parseJsonBody<{
        action?: 'import' | 'restore' | 'reset';
        spots?: StoredSpot[];
        reason?: string;
        branchId?: string;
      }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch) {
        return jsonResponse({ error: 'Forbidden' }, 403, headers);
      }
      if (body?.action === 'reset' && role !== 'super_admin') {
        return jsonResponse({ error: 'Forbidden: Master access only' }, 403, headers);
      }
      const spots = Array.isArray(body?.spots) ? body.spots : [];
      const reason = body?.reason || (body?.action === 'restore' ? 'กู้คืนข้อมูลสำรอง' : 'นำเข้าข้อมูลพิกัด');
      const res = await replaceSpotsWithBackupInDb(
        mapDb,
        targetBranch,
        spots,
        reason,
        payload.memberName
      );
      return jsonResponse({ ok: true, ...res }, 200, headers);
    }

    if (url.pathname === '/api/map/cooldowns' && request.method === 'POST') {
      const body = await parseJsonBody<{
        action?: 'start' | 'cancel';
        cooldown?: StoredCooldown;
        spotId?: string;
        branchId?: string;
      }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch) {
        return jsonResponse({ error: 'Forbidden' }, 403, headers);
      }
      if (body?.action === 'cancel') {
        const spotId = sanitizeText(body.spotId, 80);
        if (spotId) await deleteCooldownInDb(mapDb, targetBranch, spotId);
        return jsonResponse({ ok: true }, 200, headers);
      }
      if (body?.action === 'start' && body.cooldown) {
        await upsertCooldownInDb(mapDb, targetBranch, body.cooldown);
        return jsonResponse({ ok: true }, 200, headers);
      }
      return jsonResponse({ error: 'Invalid cooldown payload' }, 400, headers);
    }

    if (url.pathname === '/api/map/activity' && request.method === 'POST') {
      const body = await parseJsonBody<{
        action?: 'append' | 'clear';
        entry?: Omit<StoredActivityLog, 'id' | 'timestamp'> & { id?: string; timestamp?: number };
        branchId?: string;
      }>(request);
      const requestedBranch = sanitizeText(body?.branchId, 24);
      const targetBranch = resolveTargetBranchForMap(role, payload.sub, requestedBranch || undefined);
      if (!targetBranch) {
        return jsonResponse({ error: 'Forbidden' }, 403, headers);
      }
      if (body?.action === 'clear') {
        if (role === 'member') {
          return jsonResponse({ error: 'Forbidden: Leader or Master access only' }, 403, headers);
        }
        await clearActivityLogsInDb(mapDb, targetBranch);
        return jsonResponse({ ok: true }, 200, headers);
      }
      if (body?.action === 'append' && body.entry) {
        await appendActivityLogInDb(mapDb, targetBranch, body.entry);
        return jsonResponse({ ok: true }, 200, headers);
      }
      return jsonResponse({ error: 'Invalid activity payload' }, 400, headers);
    }

    return jsonResponse({ error: 'Map API route not found' }, 404, headers);
  }

  return jsonResponse({ error: 'API route not found' }, 404, headers);
}

const BLOCKED_PATH_PREFIXES = [
  '/.env',
  '/.git',
  '/wp-',
  '/wordpress',
  '/vendor/phpunit',
  '/cgi-bin/',
  '/alfa_data',
];

const BLOCKED_PATH_SUBSTRINGS = [
  'xmlrpc.php',
  'phpmyadmin',
  'adminer.php',
  '/.env',
  '/.git',
];

const BLOCKED_USER_AGENTS = [
  'httrack',
  'wget',
  'curl/',
  'libwww-perl',
  'python-requests',
  'python-urllib',
  'aiohttp',
  'httpx',
  'go-http-client',
  'scrapy',
  'masscan',
  'nikto',
  'sqlmap',
  'zgrab',
  'petalbot',
  'mj12bot',
  'semrushbot',
  'blexbot',
  'yandexbot',
  'zoominfobot',
];

function isBlockedEdgeRequest(request: Request, url: URL): boolean {
  const pathLower = url.pathname.toLowerCase();

  if (
    pathLower.endsWith('.php') ||
    pathLower.endsWith('.map') ||
    BLOCKED_PATH_PREFIXES.some((prefix) => pathLower.startsWith(prefix)) ||
    BLOCKED_PATH_SUBSTRINGS.some((part) => pathLower.includes(part))
  ) {
    return true;
  }

  if (pathLower === '/api/health') {
    return false;
  }

  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (ua && BLOCKED_USER_AGENTS.some((bot) => ua.includes(bot))) {
    return true;
  }

  return false;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionCtxLike): Promise<Response> {
    const url = new URL(request.url);
    if (isBlockedEdgeRequest(request, url)) {
      return new Response('Forbidden', {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      const patchedHeaders = new Headers(assetResponse.headers);
      patchedHeaders.set('X-Content-Type-Options', 'nosniff');
      patchedHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      patchedHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      patchedHeaders.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
      patchedHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      patchedHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      patchedHeaders.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: patchedHeaders,
      });
    }

    return new Response('Static assets binding missing', { status: 500 });
  },
};
