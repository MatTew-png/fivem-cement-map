import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGameDistance,
  gameCoordsToLatLngTuple,
  latLngTupleToGameCoords,
  parseFiveMCoords,
} from '../src/utils/crsMath.ts';
import {
  QUICK_CATEGORY_OPTIONS,
  SPOT_TYPES,
  buildEmptyQuickCategoryCounts,
  getSpotCategoryInfo,
  getSpotQuickCategory,
  isCementSpot,
} from '../src/utils/spotCategories.ts';
import { DEFAULT_SPOTS } from '../src/data/defaultSpots.ts';

test('GTA V coordinate conversion round-trips accurately and handles non-finite input', () => {
  const sampleCoords = [
    { x: 0, y: 0 },
    { x: -1500.5, y: 2345.2 },
    { x: 3210.4, y: -1800.8 },
  ];

  for (const pt of sampleCoords) {
    const [lat, lng] = gameCoordsToLatLngTuple(pt.x, pt.y);
    const back = latLngTupleToGameCoords(lat, lng);
    assert.ok(Math.abs(back.x - pt.x) <= 0.15, `expected x near ${pt.x}, got ${back.x}`);
    assert.ok(Math.abs(back.y - pt.y) <= 0.15, `expected y near ${pt.y}, got ${back.y}`);
  }

  const fallback = latLngTupleToGameCoords(Number.NaN, Number.POSITIVE_INFINITY);
  assert.deepEqual(fallback, { x: 0, y: 0 });
});

test('calculateGameDistance returns rounded Euclidean distance in game meters', () => {
  assert.equal(calculateGameDistance({ x: 0, y: 0 }, { x: 300, y: 400 }), 500);
  assert.equal(calculateGameDistance({ x: -10, y: 20 }, { x: -10, y: 20 }), 0);
});

test('parseFiveMCoords parses vector3, /tp, key-value, and comma pairs', () => {
  assert.deepEqual(parseFiveMCoords('vector3(-123.45, 456.78, 32.1)'), {
    x: -123.4,
    y: 456.8,
    z: 32.1,
  });
  assert.deepEqual(parseFiveMCoords('vec3(100, -200, 45)'), {
    x: 100,
    y: -200,
    z: 45,
  });
  assert.deepEqual(parseFiveMCoords('/tp 512.3 -740.9 28.4'), {
    x: 512.3,
    y: -740.9,
    z: 28.4,
  });
  assert.deepEqual(parseFiveMCoords('x: 42.2, y: -88.6'), {
    x: 42.2,
    y: -88.6,
    z: 30,
  });
  assert.equal(parseFiveMCoords('invalid string'), null);
});

test('spot categories SSOT classifies cement, dealer, farm, and default spots consistently', () => {
  assert.equal(isCementSpot({ name: 'ปูน', category: 'landmark' }), true);
  assert.equal(isCementSpot({ name: 'แลนด์มาร์คกลาง', category: 'cement_mine' }), true);
  assert.equal(isCementSpot({ name: 'ร้านสะดวกซื้อ', category: 'shop' }), false);

  assert.equal(
    getSpotQuickCategory({
      name: 'จุดขายยา (เมือง)',
      category: 'dealer',
      icon: '/blips/radar_pickup_weed_green.png',
    }),
    'dealer'
  );
  assert.equal(
    getSpotQuickCategory({
      name: 'ฟาร์มข้าว',
      category: 'farm',
      icon: '/blips/radar_contraband.png',
    }),
    'farm'
  );
  assert.equal(
    getSpotQuickCategory({
      name: 'สถานีตำรวจ',
      category: 'police_station',
      icon: '/blips/radar_police_station.png',
    }),
    'services'
  );
  assert.equal(getSpotQuickCategory({ name: 'อู่รีหัว', category: 'head_reset' }), 'head_reset');

  const dealerInfo = getSpotCategoryInfo({ category: 'dealer' });
  assert.equal(dealerInfo.id, 'dealer');
  assert.equal(dealerInfo.icon, '/blips/radar_pickup_weed_green.png');

  assert.ok(SPOT_TYPES.some((t) => t.id === 'dealer'));
  assert.ok(QUICK_CATEGORY_OPTIONS.some((q) => q.id === 'dealer'));

  const counts = buildEmptyQuickCategoryCounts();
  for (const spot of DEFAULT_SPOTS) {
    const cat = getSpotQuickCategory(spot);
    assert.ok(cat in counts, `unexpected category ${cat}`);
    counts[cat] += 1;
  }
  assert.ok(counts.cement > 0);
});
