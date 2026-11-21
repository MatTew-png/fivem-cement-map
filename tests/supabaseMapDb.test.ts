import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseRestClient } from '../worker/supabaseRest.ts';
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
} from '../worker/mapDb.ts';
import { addBan, appendSecurityLog, getGroupNames, rotateMemberPinEpoch, setGroupName } from '../worker/store.ts';

function createMockSupabaseFetch() {
  const tables = new Map<string, Array<Record<string, unknown>>>([
    [
      'groups',
      [
        {
          id: 'branch_1',
          custom_name: null,
          member_pin_date: null,
          member_pin_epoch: 0,
          leader_pin_epoch: 0,
          member_force_logout_after: 0,
          leader_force_logout_after: 0,
          spots_seeded: false,
        },
        {
          id: 'branch_2',
          custom_name: null,
          member_pin_date: null,
          member_pin_epoch: 0,
          leader_pin_epoch: 0,
          member_force_logout_after: 0,
          leader_force_logout_after: 0,
          spots_seeded: false,
        },
      ],
    ],
    ['spots', []],
    ['active_cooldowns', []],
    ['activity_logs', []],
    ['spot_backups', []],
    ['security_logs', []],
    ['ip_bans', []],
    ['rate_limits', []],
    ['app_settings', []],
  ]);

  const parseEqFilters = (url: URL) => {
    const filters: Array<[string, string]> = [];
    for (const [k, v] of url.searchParams.entries()) {
      if (v.startsWith('eq.')) filters.push([k, v.slice(3)]);
    }
    return filters;
  };

  const mockFetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.replace(/^\/rest\/v1\//, '');
    const rows = tables.get(table) ?? [];
    const method = (init?.method || 'GET').toUpperCase();
    const eqFilters = parseEqFilters(url);
    const matches = (row: Record<string, unknown>) =>
      eqFilters.every(([col, val]) => String(row[col]) === val);

    if (method === 'GET') {
      const filtered = rows.filter(matches);
      return new Response(JSON.stringify(filtered), { status: 200 });
    }

    if (method === 'POST') {
      const payload = JSON.parse(String(init?.body || '[]')) as Array<Record<string, unknown>>;
      const conflict = url.searchParams.get('on_conflict')?.split(',') ?? [];
      for (const item of payload) {
        if (conflict.length > 0) {
          const idx = rows.findIndex((r) => conflict.every((c) => r[c] === item[c]));
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...item };
          } else {
            rows.push(item);
          }
        } else {
          rows.push(item);
        }
      }
      tables.set(table, rows);
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    if (method === 'PATCH') {
      const patch = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      const updated: Array<Record<string, unknown>> = [];
      for (let i = 0; i < rows.length; i += 1) {
        if (matches(rows[i])) {
          rows[i] = { ...rows[i], ...patch };
          updated.push(rows[i]);
        }
      }
      return new Response(JSON.stringify(updated), { status: 200 });
    }

    if (method === 'DELETE') {
      tables.set(
        table,
        rows.filter((r) => !matches(r))
      );
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 405 });
  }) as typeof fetch;

  return { fetchFn: mockFetch, tables };
}

test('SupabaseRestClient + mapDb persist spots, cooldowns, activity logs, and backups per group', async () => {
  const { fetchFn } = createMockSupabaseFetch();
  const db = new SupabaseRestClient({
    url: 'https://ibtamnpkagjmnlzuejju.supabase.co',
    serviceRoleKey: 'test-service-role-key',
    fetchFn,
  });

  // 1. Seed initial spots once; subsequent seed without replace should not duplicate or overwrite
  const seedRes1 = await seedBranchSpotsInDb(db, 'branch_1', [
    {
      id: 'spot-1',
      name: 'จุดปูน #1',
      category: 'cement_mine',
      icon: '🧱',
      color: '#f59e0b',
      x: 100,
      y: 200,
      cooldownMinutes: 15,
      createdAt: 1000,
      updatedAt: 1000,
    },
  ]);
  assert.equal(seedRes1.seeded, true);
  assert.equal(seedRes1.spots.length, 1);

  const seedRes2 = await seedBranchSpotsInDb(db, 'branch_1', []);
  assert.equal(seedRes2.seeded, false);
  assert.equal(seedRes2.spots.length, 1);

  // 2. Upsert spot + start cooldown + append activity
  await upsertSpotInDb(db, 'branch_1', {
    id: 'spot-2',
    name: 'จุดปูน #2',
    category: 'cement_mine',
    icon: '🧱',
    color: '#ef4444',
    x: 300,
    y: 400,
    cooldownMinutes: 20,
    createdAt: 2000,
    updatedAt: 2000,
  });

  const now = Date.now();
  await upsertCooldownInDb(db, 'branch_1', {
    spotId: 'spot-2',
    spotName: 'จุดปูน #2',
    startedBy: 'Tester',
    startedAt: now,
    expiresAt: now + 600_000,
    durationSeconds: 600,
  });

  await appendActivityLogInDb(db, 'branch_1', {
    memberName: 'Tester',
    action: 'cooldown_start',
    details: 'เริ่มจับเวลา',
    timestamp: now,
  });

  const state1 = await getMapStateFromDb(db, 'branch_1');
  assert.equal(state1.spotsSeeded, true);
  assert.equal(state1.spots.length, 2);
  assert.equal(state1.activeCooldowns.length, 1);
  assert.equal(state1.activityLogs.length, 1);

  // 3. Replace spots creates a backup snapshot mapped cleanly for UI
  const replaced = await replaceSpotsWithBackupInDb(
    db,
    'branch_1',
    [
      {
        id: 'spot-3',
        name: 'จุดปูนใหม่',
        category: 'cement_mine',
        icon: '🧱',
        color: '#22c55e',
        x: 50,
        y: 60,
        cooldownMinutes: 10,
        createdAt: 3000,
        updatedAt: 3000,
      },
    ],
    'Import test',
    'Boss'
  );
  assert.equal(replaced.spots.length, 1);
  assert.equal(replaced.backups.length, 1);
  assert.equal(replaced.backups[0].spotsCount, 2);

  // 4. Delete spot removes both spot & cooldown; clear logs clears group logs
  await deleteCooldownInDb(db, 'branch_1', 'spot-2');
  await deleteSpotInDb(db, 'branch_1', 'spot-3');
  await clearActivityLogsInDb(db, 'branch_1');

  const state2 = await getMapStateFromDb(db, 'branch_1');
  assert.equal(state2.spots.length, 0);
  assert.equal(state2.activeCooldowns.length, 0);
  assert.equal(state2.activityLogs.length, 0);
});

test('StoreBackend routes group names, PIN epochs, bans, and logs to Supabase when db config is provided', async () => {
  const { fetchFn, tables } = createMockSupabaseFetch();
  const store = {
    db: {
      url: 'https://ibtamnpkagjmnlzuejju.supabase.co',
      serviceRoleKey: 'test-service-role-key',
      fetchFn,
    },
  };

  await setGroupName('branch_2', 'ทีมแดง', store);
  const names = await getGroupNames(store);
  assert.deepEqual(names, { branch_2: 'ทีมแดง' });

  const nextEpoch = await rotateMemberPinEpoch('branch_2', '2026-11-21', store);
  assert.equal(nextEpoch, 1);

  const bans = await addBan('203.0.113.55', 'Spam', 'Boss', store);
  assert.equal(bans.length, 1);

  await appendSecurityLog(
    {
      ip: '203.0.113.55',
      memberName: 'Tester',
      branchId: 'branch_2',
      event: 'login',
      userAgent: 'TestBrowser',
    },
    store
  );
  assert.equal(tables.get('security_logs')?.length, 1);
});
