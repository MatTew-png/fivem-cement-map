import type { CementSpot, SpotCategoryInfo } from '../types/map';
import { CATEGORIES, isCementSpot } from '../data/defaultSpots.ts';

export { CATEGORIES, isCementSpot };

export type QuickCategory =
  | 'cement'
  | 'race'
  | 'head_reset'
  | 'farm'
  | 'quest'
  | 'dealer'
  | 'lands'
  | 'fuel'
  | 'services';

export const INITIAL_QUICK_CATEGORIES_STATE: Record<QuickCategory, boolean> = {
  cement: true,
  race: true,
  head_reset: true,
  farm: true,
  quest: true,
  dealer: true,
  lands: true,
  fuel: true,
  services: true,
};

export interface QuickCategoryOption {
  id: QuickCategory;
  label: string;
  icon: string;
  activeBg: string;
  borderColor: string;
  dotColor: string;
}

export const QUICK_CATEGORY_OPTIONS: QuickCategoryOption[] = [
  {
    id: 'cement',
    label: 'ปูนซีเมนต์',
    icon: '/blips/radar_contraband_yellow.png',
    activeBg: 'bg-amber-500/20 text-amber-300',
    borderColor: 'border-amber-500/50',
    dotColor: '#f59e0b',
  },
  {
    id: 'race',
    label: 'จุดแข่งรถ',
    icon: '/blips/radar_race_land_purple.png',
    activeBg: 'bg-purple-500/20 text-purple-300',
    borderColor: 'border-purple-500/50',
    dotColor: '#a855f7',
  },
  {
    id: 'head_reset',
    label: 'จุดรีหัว / อู่ / บาร์',
    icon: '/blips/radar_bar_pink.png',
    activeBg: 'bg-pink-500/20 text-pink-300',
    borderColor: 'border-pink-500/50',
    dotColor: '#ec4899',
  },
  {
    id: 'farm',
    label: 'ฟาร์ม / งานดำ',
    icon: '/blips/radar_contraband.png',
    activeBg: 'bg-emerald-500/20 text-emerald-300',
    borderColor: 'border-emerald-500/50',
    dotColor: '#10b981',
  },
  {
    id: 'quest',
    label: 'จุดทำเควส',
    icon: '/blips/radar_friend_yellow.png',
    activeBg: 'bg-teal-500/20 text-teal-300',
    borderColor: 'border-teal-500/50',
    dotColor: '#14b8a6',
  },
  {
    id: 'dealer',
    label: 'จุดขายยา / ดีลเลอร์',
    icon: '/blips/radar_pickup_weed_green.png',
    activeBg: 'bg-red-500/20 text-red-300',
    borderColor: 'border-red-500/50',
    dotColor: '#ef4444',
  },
  {
    id: 'lands',
    label: 'แลนด์ / ร้านค้า',
    icon: '/blips/radar_player_king_yellow.png',
    activeBg: 'bg-sky-500/20 text-sky-300',
    borderColor: 'border-sky-500/50',
    dotColor: '#38bdf8',
  },
  {
    id: 'fuel',
    label: 'ปั๊มน้ำมัน',
    icon: '/blips/radar_jerry_can.png',
    activeBg: 'bg-yellow-500/20 text-yellow-300',
    borderColor: 'border-yellow-500/50',
    dotColor: '#eab308',
  },
  {
    id: 'services',
    label: 'อู่ซ่อม & บริการ',
    icon: '/blips/radar_police_station_cyan.png',
    activeBg: 'bg-slate-500/25 text-slate-200',
    borderColor: 'border-slate-500/50',
    dotColor: '#94a3b8',
  },
];

export interface SpotTypeOption {
  id: string;
  label: string;
  defaultIcon: string;
  defaultColor: string;
  description: string;
}

const SPOT_TYPE_DESCRIPTIONS: Record<string, string> = {
  cement_mine: 'จุดขุด/เก็บปูน มีคูลดาวน์',
  race: 'สนามแข่งหรือจุดรวมพลรถซิ่ง',
  head_reset: 'จุดพักลดความร้อน / รีหัว',
  farm: 'จุดฟาร์ม / แปรรูป / งานผิดกฎหมาย',
  quest: 'จุดรับภารกิจ / NPC สำคัญ',
  landmark: 'แลนด์มาร์ค / จุดนัดพบแก๊ง',
  dealer: 'จุดขายของ / รับซื้อ / ตลาดมืด',
  fuel: 'จุดเติมน้ำมัน / สำรองแกลลอน',
  services: 'สถานีตำรวจ / โรงพยาบาล / อู่ซ่อม / เบนนี่',
  shop: 'ร้านค้าทั่วไป / ร้านเสื้อผ้า / แต่งตัว',
  restaurant: 'ร้านอาหาร / คราฟต์เสบียง',
};

const CANONICAL_SPOT_TYPE_IDS = [
  'cement_mine',
  'race',
  'head_reset',
  'farm',
  'quest',
  'landmark',
  'dealer',
  'fuel',
  'services',
  'shop',
  'restaurant',
] as const;

export const SPOT_TYPES: SpotTypeOption[] = CANONICAL_SPOT_TYPE_IDS.map((id) => {
  const cat = CATEGORIES[id];
  return {
    id,
    label: cat?.name || id,
    defaultIcon: cat?.icon || '/blips/radar_player_king_white.png',
    defaultColor: cat?.color || '#38bdf8',
    description: SPOT_TYPE_DESCRIPTIONS[id] || cat?.nameEn || '',
  };
});

export function getSpotCategoryInfo(
  spot?: { category?: string; name?: string; icon?: string } | null
): SpotCategoryInfo {
  if (!spot) return CATEGORIES.landmark || CATEGORIES.cement_mine;
  if (isCementSpot(spot)) return CATEGORIES.cement_mine;
  if (spot.category && CATEGORIES[spot.category]) {
    return CATEGORIES[spot.category];
  }
  if (
    spot.icon?.includes('pickup_weed') ||
    spot.name?.includes('ขายยา') ||
    spot.name?.includes('ดีลเลอร์')
  ) {
    return CATEGORIES.dealer;
  }
  if (spot.icon?.includes('buyers_request') || spot.name?.includes('ร้านค้า')) {
    return CATEGORIES.shop || CATEGORIES.landmark;
  }
  if (spot.icon?.includes('jerry_can') || spot.name?.includes('น้ำมัน')) {
    return CATEGORIES.fuel;
  }
  return CATEGORIES.landmark || CATEGORIES.cement_mine;
}

export function getSpotQuickCategory(
  spot: Pick<CementSpot, 'id' | 'name' | 'category' | 'icon' | 'tags'>
): QuickCategory {
  if (isCementSpot(spot)) return 'cement';

  if (
    spot.category === 'race' ||
    spot.name.includes('แข่งรถ') ||
    Boolean(spot.icon && spot.icon.includes('race_land')) ||
    Boolean(spot.tags?.includes('race')) ||
    Boolean(spot.tags?.includes('แข่งรถ'))
  ) {
    return 'race';
  }

  if (
    spot.category === 'head_reset' ||
    spot.id === 'spot-1788676937650' ||
    spot.name.includes('รีหัว') ||
    spot.name.includes('ร้านเหล้า') ||
    spot.name.includes('อู่') ||
    Boolean(spot.icon && (spot.icon.includes('radar_bar') || spot.icon.includes('biker_bar'))) ||
    Boolean(spot.tags?.includes('head_reset')) ||
    Boolean(spot.tags?.includes('รีหัว'))
  ) {
    return 'head_reset';
  }

  if (
    spot.category === 'dealer' ||
    spot.name === 'จุดขายยา' ||
    spot.name.includes('ขายยา') ||
    spot.name.includes('ดีลเลอร์') ||
    spot.name.includes('ตลาดมืด') ||
    Boolean(spot.icon && spot.icon.includes('pickup_weed')) ||
    Boolean(spot.tags?.includes('dealer')) ||
    Boolean(spot.tags?.includes('จุดขายยา'))
  ) {
    return 'dealer';
  }

  if (
    spot.category === 'farm' ||
    spot.category === 'rebel' ||
    spot.category?.startsWith('flower_') ||
    spot.category?.startsWith('rice_') ||
    spot.category?.startsWith('pig_') ||
    spot.category?.startsWith('pork_') ||
    spot.category?.startsWith('wood_') ||
    spot.category === 'logging_site' ||
    spot.category === 'sawmill' ||
    spot.category === 'quarry' ||
    spot.category?.endsWith('_smelter') ||
    spot.category?.endsWith('_refinery') ||
    spot.category?.endsWith('_selling_point') ||
    spot.name.includes('ฟาร์ม') ||
    spot.name.includes('ฟาม') ||
    spot.name.includes('เรเบล') ||
    spot.name.includes('โพล') ||
    spot.name.includes('แพ็ค') ||
    spot.name.includes('หมู') ||
    spot.name.includes('ขายหมู') ||
    spot.name.includes('ขายไม้') ||
    spot.name.includes('ขายข้าว') ||
    spot.name.includes('ขายดอกไม้') ||
    Boolean(spot.icon && (spot.icon.includes('contraband') || spot.icon.includes('crim_cuff_keys')))
  ) {
    return 'farm';
  }

  if (
    spot.category === 'quest' ||
    spot.name.includes('เควส') ||
    Boolean(spot.icon && spot.icon.includes('radar_friend'))
  ) {
    return 'quest';
  }

  if (
    spot.category === 'fuel' ||
    spot.category === 'gas_station' ||
    spot.name.includes('น้ำมัน') ||
    Boolean(spot.icon && spot.icon.includes('jerry_can'))
  ) {
    return 'fuel';
  }

  if (
    spot.category === 'landmark' ||
    spot.category?.startsWith('landmark_') ||
    spot.category === 'shop' ||
    spot.category === 'restaurant' ||
    spot.name.startsWith('แลน') ||
    spot.name.includes('ร้าน') ||
    Boolean(
      spot.icon &&
        (spot.icon.includes('player_king') || spot.icon.includes('radar_pizza_this'))
    )
  ) {
    return 'lands';
  }

  return 'services';
}

export function buildEmptyQuickCategoryCounts(): Record<QuickCategory, number> {
  return {
    cement: 0,
    race: 0,
    head_reset: 0,
    farm: 0,
    quest: 0,
    dealer: 0,
    lands: 0,
    fuel: 0,
    services: 0,
  };
}
