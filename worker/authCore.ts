export const BRANCH_IDS = [
  'branch_1',
  'branch_2',
  'branch_3',
  'branch_4',
  'branch_5',
] as const;

export type BranchId = (typeof BRANCH_IDS)[number];

export const MASTER_GANG_ID = 'master_boss';

export const BRANCH_NAMES: Record<string, string> = {
  branch_1: 'กลุ่ม 1',
  branch_2: 'กลุ่ม 2',
  branch_3: 'กลุ่ม 3',
  branch_4: 'กลุ่ม 4',
  branch_5: 'กลุ่ม 5',
  master_boss: 'ผู้ดูแลระบบสูงสุด (Master Boss)',
};

export type UserRole = 'super_admin' | 'group_leader' | 'member';

export interface SessionTokenPayload {
  sub: string;
  gangName: string;
  memberName: string;
  authDate: string;
  isMaster: boolean;
  role?: UserRole;
  pinEpoch?: number;
  iat: number;
  exp: number;
  ipHash: string;
}

export function resolvePayloadRole(payload: Pick<SessionTokenPayload, 'isMaster' | 'role'>): UserRole {
  if (payload.role === 'super_admin' || payload.role === 'group_leader' || payload.role === 'member') {
    return payload.role;
  }
  return payload.isMaster ? 'super_admin' : 'member';
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array | null {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return new Uint8Array(sig);
}

/**
 * Compares two strings in constant time by hashing both inputs with SHA-256 first,
 * preventing both timing attacks and length leakage.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(a)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < bytesA.length; i += 1) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

/**
 * Returns the YYYY-MM-DD date string in Asia/Bangkok (UTC+7).
 */
export function getBangkokDateString(nowMs = Date.now()): string {
  const bangkokMs = nowMs + 7 * 60 * 60 * 1000;
  return new Date(bangkokMs).toISOString().slice(0, 10);
}

export function getUpcomingBangkokDates(days = 7, nowMs = Date.now()): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    dates.push(getBangkokDateString(nowMs + offset * 24 * 60 * 60 * 1000));
  }
  return dates;
}

export function isValidBranchId(branchId: string): boolean {
  return (BRANCH_IDS as readonly string[]).includes(branchId);
}

async function deriveSixDigitCode(secretSeed: string, message: string): Promise<string> {
  const digest = await hmacSha256(secretSeed, message);
  const value =
    (((digest[0] & 0x7f) << 24) |
      (digest[1] << 16) |
      (digest[2] << 8) |
      digest[3]) %
    1_000_000;
  return String(value).padStart(6, '0');
}

async function deriveCandidatePin(
  secretSeed: string,
  branchId: string,
  dateStr: string,
  attempt: number,
  epoch = 0
): Promise<string> {
  const input =
    epoch === 0 && attempt === 0
      ? `pin:v2:${branchId}:${dateStr}`
      : epoch === 0
      ? `pin:v2:${branchId}:${dateStr}:${attempt}`
      : `pin:v2:${branchId}:${dateStr}:e${epoch}:a${attempt}`;
  return deriveSixDigitCode(secretSeed, input);
}

/**
 * Derives persistent 6-digit Leader PINs per branch (Type B: unchanged across midnight until rotated).
 */
export async function deriveAllLeaderPins(
  secretSeed: string,
  leaderEpochs: Partial<Record<BranchId, number>> = {},
  reservedPins: ReadonlySet<string> = new Set()
): Promise<Record<BranchId, string>> {
  const result = {} as Record<BranchId, string>;
  const usedPins = new Set<string>(reservedPins);

  for (const branchId of BRANCH_IDS) {
    const epoch = Math.max(0, Math.floor(leaderEpochs[branchId] ?? 0));
    let attempt = 0;
    let pin = await deriveSixDigitCode(
      secretSeed,
      attempt === 0
        ? `leader-pin:v1:${branchId}:e${epoch}`
        : `leader-pin:v1:${branchId}:e${epoch}:a${attempt}`
    );
    while (usedPins.has(pin)) {
      attempt += 1;
      pin = await deriveSixDigitCode(
        secretSeed,
        `leader-pin:v1:${branchId}:e${epoch}:a${attempt}`
      );
    }
    usedPins.add(pin);
    result[branchId] = pin;
  }

  return result;
}

/**
 * Derives collision-free 6-digit daily Member PINs for all branches on a given date.
 */
export async function deriveAllBranchDailyPins(
  secretSeed: string,
  dateStr: string,
  options: {
    memberEpochs?: Partial<Record<BranchId, number>>;
    reservedPins?: ReadonlySet<string>;
  } = {}
): Promise<Record<BranchId, string>> {
  const result = {} as Record<BranchId, string>;
  const usedPins = new Set<string>(options.reservedPins);

  for (const branchId of BRANCH_IDS) {
    const epoch = Math.max(0, Math.floor(options.memberEpochs?.[branchId] ?? 0));
    let attempt = 0;
    let pin = await deriveCandidatePin(secretSeed, branchId, dateStr, attempt, epoch);
    while (usedPins.has(pin)) {
      attempt += 1;
      pin = await deriveCandidatePin(secretSeed, branchId, dateStr, attempt, epoch);
    }
    usedPins.add(pin);
    result[branchId] = pin;
  }

  return result;
}

/**
 * Derives a deterministic, collision-free 6-digit daily PIN using HMAC-SHA256.
 */
export async function deriveDailyPin(
  secretSeed: string,
  branchId: string,
  dateStr: string,
  options: {
    memberEpochs?: Partial<Record<BranchId, number>>;
    reservedPins?: ReadonlySet<string>;
  } = {}
): Promise<string> {
  if (isValidBranchId(branchId)) {
    const pins = await deriveAllBranchDailyPins(secretSeed, dateStr, options);
    return pins[branchId as BranchId];
  }
  return deriveCandidatePin(secretSeed, branchId, dateStr, 0, 0);
}

/**
 * Resolves which branch owns the provided daily Member PIN in constant-time comparisons.
 */
export async function resolveBranchByPin(
  secretSeed: string,
  inputPin: string,
  dateStr: string,
  options: {
    memberEpochs?: Partial<Record<BranchId, number>>;
    reservedPins?: ReadonlySet<string>;
  } = {}
): Promise<BranchId | null> {
  const pins = await deriveAllBranchDailyPins(secretSeed, dateStr, options);
  let matchedBranch: BranchId | null = null;
  for (const branchId of BRANCH_IDS) {
    if (await timingSafeEqual(inputPin, pins[branchId])) {
      matchedBranch = branchId;
    }
  }
  return matchedBranch;
}

export async function resolvePinCredentials(options: {
  masterPin: string;
  secretSeed: string;
  inputPin: string;
  dateStr: string;
  leaderEpochs?: Partial<Record<BranchId, number>>;
  memberEpochs?: Partial<Record<BranchId, number>>;
  requestedBranchId?: string;
}): Promise<{ role: UserRole; branchId: string; pinEpoch: number } | null> {
  const { masterPin, secretSeed, inputPin, dateStr, leaderEpochs, memberEpochs, requestedBranchId } = options;

  if (await timingSafeEqual(inputPin, masterPin)) {
    return { role: 'super_admin', branchId: MASTER_GANG_ID, pinEpoch: 0 };
  }

  const leaderReserved = new Set<string>([masterPin]);
  const leaderPins = await deriveAllLeaderPins(secretSeed, leaderEpochs, leaderReserved);

  for (const branchId of BRANCH_IDS) {
    if (requestedBranchId && requestedBranchId !== branchId) continue;
    if (await timingSafeEqual(inputPin, leaderPins[branchId])) {
      return {
        role: 'group_leader',
        branchId,
        pinEpoch: Math.max(0, Math.floor(leaderEpochs?.[branchId] ?? 0)),
      };
    }
  }

  const memberReserved = new Set<string>([masterPin, ...Object.values(leaderPins)]);
  const memberPins = await deriveAllBranchDailyPins(secretSeed, dateStr, {
    memberEpochs,
    reservedPins: memberReserved,
  });

  for (const branchId of BRANCH_IDS) {
    if (requestedBranchId && requestedBranchId !== branchId) continue;
    if (await timingSafeEqual(inputPin, memberPins[branchId])) {
      return {
        role: 'member',
        branchId,
        pinEpoch: Math.max(0, Math.floor(memberEpochs?.[branchId] ?? 0)),
      };
    }
  }

  return null;
}

/**
 * Derives a non-secret daily MQTT channel identifier so clients do not embed GANG_SECRET_SEED.
 */
export async function deriveDailyChannelKey(
  secretSeed: string,
  dateStr: string
): Promise<string> {
  const digest = await hmacSha256(secretSeed, `mqtt:v2:${dateStr}`);
  return toBase64Url(digest.slice(0, 12));
}

export async function hashIdentifier(secretSalt: string, value: string): Promise<string> {
  const digest = await hmacSha256(secretSalt, `id:${value}`);
  return toBase64Url(digest.slice(0, 12));
}

export async function signSessionToken(
  payload: SessionTokenPayload,
  secret: string
): Promise<string> {
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(secret, encodedPayload);
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  options: {
    nowMs?: number;
    currentDate?: string;
    forceLogoutAfter?: number;
  } = {}
): Promise<SessionTokenPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;

  const expectedSig = await hmacSha256(secret, encodedPayload);
  const expectedSigB64 = toBase64Url(expectedSig);
  const sigMatch = await timingSafeEqual(encodedSig, expectedSigB64);
  if (!sigMatch) return null;

  const payloadBytes = fromBase64Url(encodedPayload);
  if (!payloadBytes) return null;

  let parsed: SessionTokenPayload;
  try {
    parsed = JSON.parse(textDecoder.decode(payloadBytes)) as SessionTokenPayload;
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed.sub !== 'string' ||
    typeof parsed.memberName !== 'string' ||
    typeof parsed.authDate !== 'string' ||
    typeof parsed.exp !== 'number' ||
    typeof parsed.iat !== 'number'
  ) {
    return null;
  }

  const nowMs = options.nowMs ?? Date.now();
  if (nowMs > parsed.exp) return null;

  const role = resolvePayloadRole(parsed);
  const currentDate = options.currentDate ?? getBangkokDateString(nowMs);
  if (role === 'member' && parsed.authDate !== currentDate) {
    return null;
  }

  if (options.forceLogoutAfter && parsed.iat < options.forceLogoutAfter && role !== 'super_admin') {
    return null;
  }

  return parsed;
}

export function sanitizeText(value: unknown, maxLen = 64): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (let i = 0; i < value.length && out.length < maxLen; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += value[i];
    }
  }
  return out.trim();
}

export function isValidDiscordWebhookUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr.trim());
    if (url.protocol !== 'https:') return false;
    const isDiscordHost =
      url.hostname === 'discord.com' ||
      url.hostname === 'discordapp.com' ||
      url.hostname === 'ptb.discord.com' ||
      url.hostname === 'canary.discord.com';
    return isDiscordHost && url.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return '127.0.0.1';
  }
  return 'unknown';
}

export function isOriginAllowed(
  origin: string | null,
  requestUrl: URL,
  allowedOriginsRaw?: string
): boolean {
  if (!origin) return true;
  if (origin === requestUrl.origin) return true;

  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'http://localhost' ||
    origin === 'http://127.0.0.1'
  ) {
    return true;
  }

  if (allowedOriginsRaw) {
    const allowed = allowedOriginsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.includes(origin)) return true;
  }

  if (
    origin.endsWith('.pages.dev') ||
    origin.endsWith('.workers.dev')
  ) {
    return true;
  }

  return false;
}

export function buildApiHeaders(
  request: Request,
  allowedOriginsRaw?: string
): Record<string, string> {
  const origin = request.headers.get('Origin');
  const requestUrl = new URL(request.url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Vary': 'Origin',
  };

  if (origin && isOriginAllowed(origin, requestUrl, allowedOriginsRaw)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}
