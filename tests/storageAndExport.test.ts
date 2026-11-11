import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFiveMCommand,
  formatFiveMLuaTable,
  formatFiveMVector,
  getBackupSnapshots,
  getCooldownsKey,
  getSpotsKey,
  loadSpotsFromStorage,
  parseImportedSpots,
  restoreBackupSnapshot,
  saveSpotsToStorage,
} from '../src/utils/storage.ts';
import { formatSpotsToAstroRecord, formatSpotsToEuclidJSON } from '../src/utils/spotExport.ts';
import type { CementSpot } from '../src/types/map';

const originalLocalStorage = globalThis.localStorage;
const backingStore = new Map<string, string>();

const mockStorage: Storage = {
  get length() {
    return backingStore.size;
  },
  clear() {
    backingStore.clear();
  },
  getItem(key: string) {
    return backingStore.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(backingStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    backingStore.delete(key);
  },
  setItem(key: string, value: string) {
    backingStore.set(key, String(value));
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  configurable: true,
});

beforeEach(() => {
  backingStore.clear();
});

after(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
  });
});

test('storage keys normalize and isolate per branch', () => {
  assert.equal(getSpotsKey('สาขา 2'), 'fivem_cement_spots_branch_2_v7');
  assert.equal(getSpotsKey('branch_2'), 'fivem_cement_spots_branch_2_v7');
  assert.notEqual(getSpotsKey('branch_1'), getSpotsKey('branch_2'));
  assert.equal(getCooldownsKey('สาขา 3'), 'fivem_cement_cooldowns_branch_3_v7');
});

test('parseImportedSpots validates coordinates, clamps cooldowns, and sanitizes icon URLs', () => {
  const imported = parseImportedSpots(
    JSON.stringify([
      {
        id: 'custom-1',
        name: '  จุดลับ   ',
        category: 'dealer',
        x: 123.456,
        y: -456.789,
        z: 31.23,
        cooldownMinutes: 120,
        icon: 'javascript:alert(1)',
        color: '#22c55e',
        tags: ['farm', ' ', 'safe'],
      },
    ])
  );

  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, 'จุดลับ');
  assert.equal(imported[0].x, 123.5);
  assert.equal(imported[0].y, -456.8);
  assert.equal(imported[0].z, 31.2);
  assert.equal(imported[0].cooldownMinutes, 60);
  assert.equal(imported[0].icon, 'javascript:alert'); // non-URL string truncated, not scriptable URL
  assert.deepEqual(imported[0].tags, ['farm', 'safe']);

  assert.throws(() => parseImportedSpots('{"not":"array"}'));
  assert.throws(() => parseImportedSpots('[{"name":"Missing coords"}]'));
});

test('storage saves, creates backup snapshots, and restores spots with official defaults merged', () => {
  const customSpot: CementSpot = {
    id: 'custom-spot-test',
    name: 'หมุดทดสอบ',
    category: 'landmark',
    x: 100,
    y: 200,
    z: 30,
    cooldownMinutes: 15,
    createdAt: 1000,
    updatedAt: 2000,
  };

  saveSpotsToStorage([customSpot], 'branch_2');
  const snapshots = getBackupSnapshots('branch_2');
  assert.equal(snapshots.length, 1);

  const loaded = loadSpotsFromStorage('branch_2');
  assert.ok(loaded);
  assert.ok(loaded.some((s) => s.id === 'custom-spot-test'));
  assert.ok(loaded.length > 1, 'should merge DEFAULT_SPOTS');

  const restored = restoreBackupSnapshot(snapshots[0].id, 'branch_2');
  assert.ok(restored?.some((s) => s.id === 'custom-spot-test'));
});

test('export formatters escape quotes and format FiveM commands accurately', () => {
  const spot: CementSpot = {
    id: 'id-1',
    name: `Spot "A" 'B'\\C\nNext`,
    category: 'cement_mine',
    icon: '/blips/radar_cement.png',
    color: '#eab308',
    x: 12.34,
    y: -56.78,
    z: 30.5,
    postal: '101',
    cooldownMinutes: 10,
    notes: `Boss's note`,
    createdAt: 1000,
    updatedAt: 2000,
  };

  assert.equal(formatFiveMCommand(spot), '/tp 12.3 -56.8 30.5');
  assert.equal(formatFiveMVector(spot), 'vec3(12.34, -56.78, 30.50)');

  const lua = formatFiveMLuaTable([spot]);
  assert.ok(lua.includes('name = "Spot \\"A\\" \'B\'\\\\C\\nNext"'));
  assert.ok(lua.includes('cooldown = 600, -- seconds'));

  const euclidJson = JSON.parse(formatSpotsToEuclidJSON([spot])) as Array<{ id: string; x: number }>;
  assert.equal(euclidJson[0].id, 'id-1');
  assert.equal(euclidJson[0].x, 12.3);

  const astro = formatSpotsToAstroRecord([spot]);
  assert.ok(astro.includes(`title: 'Spot "A" \\'B\\'\\\\C\\nNext'`));
  assert.ok(astro.includes(`desc: 'Boss\\'s note'`));
});
