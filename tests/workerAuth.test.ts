import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';
import {
  BRANCH_IDS,
  deriveDailyChannelKey,
  deriveDailyPin,
  getBangkokDateString,
  isOriginAllowed,
  isValidDiscordWebhookUrl,
  signSessionToken,
  timingSafeEqual,
  verifySessionToken,
} from '../worker/authCore.ts';
import type { KvStoreLike } from '../worker/store.ts';
import type { WorkerEnv } from '../worker/index.ts';

function createMemoryKv(): KvStoreLike {
  const store = new Map<string, string>();
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
  };
}

function createTestEnv(kv: KvStoreLike): WorkerEnv {
  return {
    GANG_VAULT: kv,
    MASTER_PIN: '998877',
    GANG_SECRET_SEED: 'unit-test-seed-secret-key-32-chars',
    SESSION_SECRET: 'unit-test-session-secret-key-32ch',
  };
}

const dummyCtx = {
  waitUntil(_promise: Promise<unknown>): void {
    // no-op for tests
  },
};

test('deriveDailyPin returns deterministic 6-digit branch PINs per date', async () => {
  const pinA1 = await deriveDailyPin('seed-123', 'branch_1', '2026-10-06');
  const pinA2 = await deriveDailyPin('seed-123', 'branch_1', '2026-10-06');
  const pinB1 = await deriveDailyPin('seed-123', 'branch_2', '2026-10-06');
  const pinNextDay = await deriveDailyPin('seed-123', 'branch_1', '2026-10-07');

  assert.match(pinA1, /^\d{6}$/);
  assert.equal(pinA1, pinA2);
  assert.notEqual(pinA1, pinB1);
  assert.notEqual(pinA1, pinNextDay);
  assert.equal(BRANCH_IDS.length, 5);
});

test('deriveDailyChannelKey creates non-secret deterministic channel IDs', async () => {
  const key1 = await deriveDailyChannelKey('seed-123', '2026-10-06');
  const key2 = await deriveDailyChannelKey('seed-123', '2026-10-06');
  const keyOther = await deriveDailyChannelKey('seed-123', '2026-10-07');

  assert.ok(key1.length >= 12);
  assert.equal(key1, key2);
  assert.notEqual(key1, keyOther);
  assert.ok(!key1.includes('seed-123'));
});

test('signSessionToken and verifySessionToken enforce integrity, date, and forceLogoutAfter', async () => {
  const secret = 'session-secret-xyz';
  const nowMs = Date.UTC(2026, 9, 6, 12, 0, 0);
  const today = getBangkokDateString(nowMs);

  const memberToken = await signSessionToken(
    {
      sub: 'branch_1',
      gangName: 'สาขา 1',
      memberName: 'Tester',
      authDate: today,
      isMaster: false,
      iat: nowMs,
      exp: nowMs + 60_000,
      ipHash: 'abc',
    },
    secret
  );

  const verified = await verifySessionToken(memberToken, secret, {
    nowMs,
    currentDate: today,
  });
  assert.equal(verified?.sub, 'branch_1');

  // Tampered payload rejected
  const tampered = `x${memberToken.slice(1)}`;
  assert.equal(await verifySessionToken(tampered, secret, { nowMs, currentDate: today }), null);

  // Wrong date invalidates non-master token
  assert.equal(
    await verifySessionToken(memberToken, secret, { nowMs, currentDate: '2026-10-07' }),
    null
  );

  // forceLogoutAfter revokes older member tokens
  assert.equal(
    await verifySessionToken(memberToken, secret, {
      nowMs,
      currentDate: today,
      forceLogoutAfter: nowMs + 1,
    }),
    null
  );

  // Expired token rejected
  assert.equal(
    await verifySessionToken(memberToken, secret, {
      nowMs: nowMs + 120_000,
      currentDate: today,
    }),
    null
  );
});

test('timingSafeEqual compares strings without false positives', async () => {
  assert.equal(await timingSafeEqual('123456', '123456'), true);
  assert.equal(await timingSafeEqual('123456', '123457'), false);
  assert.equal(await timingSafeEqual('12345', '123456'), false);
});

test('webhook URL and origin allowlist validation enforce strict origins', () => {
  assert.equal(
    isValidDiscordWebhookUrl('https://discord.com/api/webhooks/12345/secret-token'),
    true
  );
  assert.equal(isValidDiscordWebhookUrl('http://discord.com/api/webhooks/12345/abc'), false);
  assert.equal(isValidDiscordWebhookUrl('https://evil.example/api/webhooks/12345/abc'), false);

  const prodUrl = new URL('https://runthukverb-auth-api.workers.dev/api/health');
  assert.equal(isOriginAllowed('https://runthukverb-auth-api.workers.dev', prodUrl), true);
  assert.equal(isOriginAllowed('https://evil.example', prodUrl), false);
  assert.equal(
    isOriginAllowed('https://custom.example', prodUrl, 'https://custom.example'),
    true
  );
});

test('Worker API handles health, lockout, branch vs master auth, pins, bans, and force-logout', async () => {
  const kv = createMemoryKv();
  const env = createTestEnv(kv);

  // 1. Health endpoint
  const healthRes = await worker.fetch(
    new Request('https://example.workers.dev/api/health'),
    env,
    dummyCtx
  );
  assert.equal(healthRes.status, 200);
  const healthJson = (await healthRes.json()) as { ok: boolean; configured: boolean; kvBound: boolean };
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.configured, true);
  assert.equal(healthJson.kvBound, true);

  // 2. Wrong PIN brute-force rate limit triggers 429 on 5th failure
  for (let i = 1; i <= 5; i += 1) {
    const failRes = await worker.fetch(
      new Request('https://example.workers.dev/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '203.0.113.10',
        },
        body: JSON.stringify({ memberName: 'Attacker', branchId: 'branch_1', pin: '000000' }),
      }),
      env,
      dummyCtx
    );
    assert.equal(failRes.status, i < 5 ? 401 : 429);
  }

  // 3. Valid daily branch PIN issues session token and denies master-only endpoints
  const today = getBangkokDateString();
  const branch2Pin = await deriveDailyPin(env.GANG_SECRET_SEED!, 'branch_2', today);
  const branchLoginRes = await worker.fetch(
    new Request('https://example.workers.dev/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.20',
      },
      body: JSON.stringify({ memberName: 'MemberB2', branchId: 'branch_2', pin: branch2Pin }),
    }),
    env,
    dummyCtx
  );
  assert.equal(branchLoginRes.status, 200);
  const branchData = (await branchLoginRes.json()) as {
    token: string;
    session: { gangId: string; isMaster: boolean };
  };
  assert.equal(branchData.session.gangId, 'branch_2');
  assert.equal(branchData.session.isMaster, false);

  const deniedUpcoming = await worker.fetch(
    new Request('https://example.workers.dev/api/pins/upcoming', {
      headers: {
        Authorization: `Bearer ${branchData.token}`,
        'cf-connecting-ip': '203.0.113.20',
      },
    }),
    env,
    dummyCtx
  );
  assert.equal(deniedUpcoming.status, 403);

  // 4. Master PIN login grants upcoming schedule + IP ban control + force logout
  const masterLoginRes = await worker.fetch(
    new Request('https://example.workers.dev/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.99',
      },
      body: JSON.stringify({
        memberName: 'Boss',
        branchId: 'branch_1',
        pin: env.MASTER_PIN,
      }),
    }),
    env,
    dummyCtx
  );
  assert.equal(masterLoginRes.status, 200);
  const masterData = (await masterLoginRes.json()) as { token: string; session: { isMaster: boolean } };
  assert.equal(masterData.session.isMaster, true);

  const upcomingRes = await worker.fetch(
    new Request('https://example.workers.dev/api/pins/upcoming', {
      headers: {
        Authorization: `Bearer ${masterData.token}`,
        'cf-connecting-ip': '203.0.113.99',
      },
    }),
    env,
    dummyCtx
  );
  assert.equal(upcomingRes.status, 200);
  const upcomingJson = (await upcomingRes.json()) as { schedule: Array<{ date: string; pins: Record<string, string> }> };
  assert.equal(upcomingJson.schedule.length, 7);

  // 5. Ban & unban IP
  const banRes = await worker.fetch(
    new Request('https://example.workers.dev/api/security/ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterData.token}`,
        'cf-connecting-ip': '203.0.113.99',
      },
      body: JSON.stringify({ ip: '203.0.113.20', reason: 'Test ban' }),
    }),
    env,
    dummyCtx
  );
  assert.equal(banRes.status, 200);

  const bannedSessionRes = await worker.fetch(
    new Request('https://example.workers.dev/api/session', {
      headers: {
        Authorization: `Bearer ${branchData.token}`,
        'cf-connecting-ip': '203.0.113.20',
      },
    }),
    env,
    dummyCtx
  );
  assert.equal(bannedSessionRes.status, 403);

  const unbanRes = await worker.fetch(
    new Request('https://example.workers.dev/api/security/unban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${masterData.token}`,
        'cf-connecting-ip': '203.0.113.99',
      },
      body: JSON.stringify({ ip: '203.0.113.20' }),
    }),
    env,
    dummyCtx
  );
  assert.equal(unbanRes.status, 200);

  // 6. Force-logout revokes older branch session tokens while keeping master active
  const forceLogoutRes = await worker.fetch(
    new Request('https://example.workers.dev/api/admin/force-logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${masterData.token}`,
        'cf-connecting-ip': '203.0.113.99',
      },
    }),
    env,
    dummyCtx
  );
  assert.equal(forceLogoutRes.status, 200);

  const revokedBranchSession = await worker.fetch(
    new Request('https://example.workers.dev/api/session', {
      headers: {
        Authorization: `Bearer ${branchData.token}`,
        'cf-connecting-ip': '203.0.113.20',
      },
    }),
    env,
    dummyCtx
  );
  assert.equal(revokedBranchSession.status, 401);
});
