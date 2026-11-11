import {
  BRANCH_IDS,
  BRANCH_NAMES,
  MASTER_GANG_ID,
  buildApiHeaders,
  deriveDailyChannelKey,
  deriveDailyPin,
  extractClientIp,
  getBangkokDateString,
  getUpcomingBangkokDates,
  hashIdentifier,
  isOriginAllowed,
  isValidBranchId,
  isValidDiscordWebhookUrl,
  sanitizeText,
  signSessionToken,
  timingSafeEqual,
  verifySessionToken,
  type SessionTokenPayload,
} from './authCore.ts';
import {
  addBan,
  appendSecurityLog,
  clearRateLimit,
  findBanByIp,
  getBanList,
  getConfiguredWebhookUrl,
  getForceLogoutAfter,
  getRateLimitStatus,
  getSecurityLogs,
  maskWebhookUrl,
  recordFailedAttempt,
  removeBan,
  sendDiscordSecurityAlert,
  setForceLogoutAfter,
  setStoredWebhookUrl,
  type KvStoreLike,
} from './store.ts';

export interface WorkerEnv {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  GANG_VAULT?: KvStoreLike;
  MASTER_PIN?: string;
  GANG_SECRET_SEED?: string;
  SESSION_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
  ALLOWED_ORIGINS?: string;
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
  const forceLogoutAfter = await getForceLogoutAfter(env.GANG_VAULT);
  return verifySessionToken(token, secret, { forceLogoutAfter });
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

  const kv = env.GANG_VAULT;
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
        service: 'runthukverb-auth-api',
        configured: Boolean(env.MASTER_PIN?.trim() && env.GANG_SECRET_SEED?.trim()),
        kvBound: Boolean(kv),
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
    const requestedBranch = sanitizeText(body.branchId, 24) || 'branch_1';

    if (!memberName) {
      return jsonResponse({ success: false, error: 'กรุณาระบุชื่อเล่นในแก๊ง' }, 400, headers);
    }
    if (!pin) {
      return jsonResponse({ success: false, error: 'กรุณากรอกรหัสผ่าน' }, 400, headers);
    }

    const todayStr = getBangkokDateString();
    const isMaster = await timingSafeEqual(pin, masterPin);
    let isValidBranchPin = false;

    if (!isMaster) {
      if (!isValidBranchId(requestedBranch)) {
        return jsonResponse(
          { success: false, error: 'ไม่พบสาขาที่เลือก' },
          400,
          headers
        );
      }
      const expectedPin = await deriveDailyPin(secretSeed, requestedBranch, todayStr);
      isValidBranchPin = await timingSafeEqual(pin, expectedPin);
    }

    if (!isMaster && !isValidBranchPin) {
      const nextRate = await recordFailedAttempt(clientIp, kv);
      const log = await appendSecurityLog(
        {
          ip: clientIp,
          memberName,
          branchId: requestedBranch,
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

    const gangId = isMaster ? MASTER_GANG_ID : requestedBranch;
    const gangName = BRANCH_NAMES[gangId] ?? requestedBranch;
    const nowMs = Date.now();
    const sessionSecret = getSessionSecret(env);
    const ipHash = await hashIdentifier(sessionSecret, clientIp);
    const payload: SessionTokenPayload = {
      sub: gangId,
      gangName,
      memberName,
      authDate: todayStr,
      isMaster,
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
        session: {
          gangId,
          gangName,
          memberName,
          authDate: todayStr,
          authenticatedAt: nowMs,
          isMaster,
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
    const channelKey = secretSeed
      ? await deriveDailyChannelKey(secretSeed, todayStr)
      : undefined;

    return jsonResponse(
      {
        valid: true,
        channelKey,
        session: {
          gangId: payload.sub,
          gangName: payload.gangName,
          memberName: payload.memberName,
          authDate: payload.authDate,
          authenticatedAt: payload.iat,
          isMaster: payload.isMaster,
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
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden: Master access only' }, 403, headers);
    }

    const secretSeed = env.GANG_SECRET_SEED?.trim() ?? '';
    if (!secretSeed) {
      return jsonResponse({ error: 'GANG_SECRET_SEED is not configured' }, 503, headers);
    }

    const dates = getUpcomingBangkokDates(7);
    const schedule = await Promise.all(
      dates.map(async (date) => {
        const pins: Record<string, string> = {};
        for (const branchId of BRANCH_IDS) {
          pins[branchId] = await deriveDailyPin(secretSeed, branchId, date);
        }
        return { date, pins };
      })
    );

    return jsonResponse({ schedule }, 200, headers);
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
    if (!payload.isMaster) {
      return jsonResponse({ error: 'Forbidden' }, 403, headers);
    }

    const forceLogoutAfter = Date.now();
    await setForceLogoutAfter(forceLogoutAfter, kv);
    return jsonResponse({ ok: true, forceLogoutAfter }, 200, headers);
  }

  return jsonResponse({ error: 'API route not found' }, 404, headers);
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionCtxLike): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx);
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      const patchedHeaders = new Headers(assetResponse.headers);
      patchedHeaders.set('X-Content-Type-Options', 'nosniff');
      patchedHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      patchedHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: patchedHeaders,
      });
    }

    return new Response('Static assets binding missing', { status: 500 });
  },
};
