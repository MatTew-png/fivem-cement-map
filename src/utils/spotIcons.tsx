import { escapeHtml, isImageIconString, sanitizeIconUrl } from './html';

export interface SpotIconOption {
  emoji: string;
  name: string;
}

export interface SpotIconCategory {
  group: string;
  icons: SpotIconOption[];
}

export const ICON_CATEGORIES: SpotIconCategory[] = [
  {
    group: '⭐ ทั้งหมด (FiveM Blips)',
    icons: [
      { emoji: '/blips/radar_pickup_weed_green.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - เขียว (Green)' },
      { emoji: '/blips/radar_pickup_weed.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ขาว (White)' },
      { emoji: '/blips/radar_pickup_weed_yellow.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - เหลือง (Yellow)' },
      { emoji: '/blips/radar_pickup_weed_red.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - แดง (Red)' },
      { emoji: '/blips/radar_pickup_weed_purple.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ม่วง (Purple)' },
      { emoji: '/blips/radar_pickup_weed_cyan.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_pickup_weed_orange.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ส้ม (Orange)' },
      { emoji: '/blips/radar_player_king_white.png', name: '[439] King มงกุฎ - ขาว (White)' },
      { emoji: '/blips/radar_player_king_yellow.png', name: '[439] King มงกุฎ - เหลือง (Yellow)' },
      { emoji: '/blips/radar_player_king_red.png', name: '[439] King มงกุฎ - แดง (Red)' },
      { emoji: '/blips/radar_player_king_orange.png', name: '[439] King มงกุฎ - ส้ม (Orange)' },
      { emoji: '/blips/radar_player_king_green.png', name: '[439] King มงกุฎ - เขียว (Green)' },
      { emoji: '/blips/radar_player_king_cyan.png', name: '[439] King มงกุฎ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_player_king_blue.png', name: '[439] King มงกุฎ - น้ำเงิน (Blue)' },
      { emoji: '/blips/radar_player_king_mint.png', name: '[439] King มงกุฎ - มิ้นต์ (Mint)' },
      { emoji: '/blips/radar_player_king_purple.png', name: '[439] King มงกุฎ - ม่วง (Purple)' },
      { emoji: '/blips/radar_player_king_brown.png', name: '[439] King มงกุฎ - น้ำตาล (Brown)' },
      { emoji: '/blips/radar_player_king_pink.png', name: '[439] King มงกุฎ - ชมพู (Pink)' },
      { emoji: '/blips/radar_friend_yellow.png', name: '[280] Friend เพื่อน / ทีม / เควส - เหลือง (Yellow)' },
      { emoji: '/blips/radar_friend_pink.png', name: '[280] Friend เพื่อน / ทีม - ชมพู (Pink)' },
      { emoji: '/blips/radar_friend_green.png', name: '[280] Friend เพื่อน / ทีม - เขียว (Green)' },
      { emoji: '/blips/radar_friend_red.png', name: '[280] Friend เพื่อน / ทีม - แดง (Red)' },
      { emoji: '/blips/radar_friend.png', name: '[280] Friend เพื่อน / ทีม - ขาว (White)' },
      { emoji: '/blips/radar_contraband_gray.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - เทา (Gray)' },
      { emoji: '/blips/radar_contraband_white.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ขาว (White)' },
      { emoji: '/blips/radar_contraband_yellow.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - เหลือง (Yellow)' },
      { emoji: '/blips/radar_contraband_pink.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ชมพู (Pink)' },
      { emoji: '/blips/radar_contraband_brown.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - น้ำตาล (Brown)' },
      { emoji: '/blips/radar_contraband.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ปกติ' },
      { emoji: '/blips/radar_bar_pink.png', name: '[93] Bar รีหัว / บาร์เหล้า - ชมพู (Pink)' },
      { emoji: '/blips/radar_bar_green.png', name: '[93] Bar รีหัว / บาร์เหล้า - เขียว (Green)' },
      { emoji: '/blips/radar_bar_purple.png', name: '[93] Bar รีหัว / บาร์เหล้า - ม่วง (Purple)' },
      { emoji: '/blips/radar_bar.png', name: '[93] Bar รีหัว / บาร์เหล้า - ขาว (White)' },
      { emoji: '/blips/radar_biker_bar_purple.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ / ขวดเหล้า - ม่วง (Purple)' },
      { emoji: '/blips/radar_biker_bar.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ / ขวดเหล้า - ขาว (White)' },
      { emoji: '/blips/radar_race_land_purple.png', name: '[315] Race Land แข่งรถทางบก - ม่วง (Purple)' },
      { emoji: '/blips/radar_race_land.png', name: '[315] Race Land แข่งรถทางบก - ขาว (White)' },
      { emoji: '/blips/radar_bennys_blue.png', name: "[446] Benny's อู่แต่งรถ / ไขควงประแจ - น้ำเงิน (Blue)" },
      { emoji: '/blips/radar_bennys.png', name: "[446] Benny's อู่แต่งรถ / ไขควงประแจ - ขาว (White)" },
      { emoji: '/blips/radar_pickup_repair_red.png', name: '[544] Pickup Repair ประแจซ่อม / อู่ซ่อม - แดง (Red)' },
      { emoji: '/blips/radar_pickup_repair.png', name: '[544] Pickup Repair ประแจซ่อม / อู่ซ่อม - ขาว (White)' },
      { emoji: '/blips/radar_crim_cuff_keys_red.png', name: '[134] Cuff Keys กุญแจมือ - แดง (Red)' },
      { emoji: '/blips/radar_crim_cuff_keys.png', name: '[134] Cuff Keys กุญแจมือ - ขาว (White)' },
      { emoji: '/blips/radar_handcuff_keys_bikers_red.png', name: '[186] Handcuff Keys กุญแจมือไข - แดง (Red)' },
      { emoji: '/blips/radar_handcuff_keys_bikers.png', name: '[186] Handcuff Keys กุญแจมือไข - ขาว (White)' },
      { emoji: '/blips/radar_hospital_green.png', name: '[61] Hospital โรงพยาบาล / หมอ - เขียว (Green)' },
      { emoji: '/blips/radar_hospital.png', name: '[61] Hospital โรงพยาบาล - ปกติ' },
      { emoji: '/blips/radar_police_station_cyan.png', name: '[60] Police Station สถานีตำรวจ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_police_station.png', name: '[60] Police Station สถานีตำรวจ - ปกติ' },
      { emoji: '/blips/radar_jerry_can.png', name: '[361] Jerry Can แกลลอนน้ำมัน' },
      { emoji: '/blips/radar_warehouse_vehicle_yellow.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - เหลือง' },
      { emoji: '/blips/radar_warehouse_vehicle.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - ปกติ' },
      { emoji: '/blips/radar_office_cyan.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_office.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ขาว (White)' },
      { emoji: '/blips/radar_adversary_bunker_gray.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - เทา (Gray)' },
      { emoji: '/blips/radar_adversary_bunker.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - ขาว (White)' },
      { emoji: '/blips/radar_garbage_cyan.png', name: '[318] Garbage ถังขยะ / รถขยะ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_garbage_gray.png', name: '[318] Garbage ถังขยะ / รถขยะ - เทา (Gray)' },
      { emoji: '/blips/radar_garbage_orange.png', name: '[318] Garbage ถังขยะ / รถขยะ - ส้ม (Orange)' },
      { emoji: '/blips/radar_garbage_yellow.png', name: '[318] Garbage ถังขยะ / รถขยะ - เหลือง (Yellow)' },
      { emoji: '/blips/radar_garbage.png', name: '[318] Garbage ถังขยะ / รถขยะ - ปกติ' },
      { emoji: '/blips/radar_ugc_mission_yellow.png', name: '[304] UGC Mission ภารกิจ / ดาว - เหลือง (Yellow)' },
      { emoji: '/blips/radar_ugc_mission.png', name: '[304] UGC Mission ภารกิจ / ดาว - ขาว (White)' },
      { emoji: '/blips/radar_mask_cyan.png', name: '[362] Mask หน้ากาก / ร้านหน้ากาก - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_mask.png', name: '[362] Mask หน้ากาก / ร้านหน้ากาก - ขาว (White)' },
      { emoji: '/blips/radar_barber_green.png', name: '[71] Barber ร้านตัดผม - เขียว' },
      { emoji: '/blips/radar_barber.png', name: '[71] Barber ร้านตัดผม - ปกติ' },
      { emoji: '/blips/radar_clothes_store_red.png', name: '[73] Clothes Store ร้านเสื้อผ้า - แดง' },
      { emoji: '/blips/radar_clothes_store.png', name: '[73] Clothes Store ร้านเสื้อผ้า - ปกติ' },
      { emoji: '/blips/radar_tattoo.png', name: '[75] Tattoo ร้านสักลาย' },
      { emoji: '/blips/radar_gang_vehicle_yellow.png', name: '[225] Gang Vehicle รถแก๊ง - เหลือง' },
      { emoji: '/blips/radar_gang_vehicle_red.png', name: '[225] Gang Vehicle รถแก๊ง - แดง' },
      { emoji: '/blips/radar_gang_vehicle.png', name: '[225] Gang Vehicle รถแก๊ง - ปกติ' },
      { emoji: '/blips/radar_arena_zr380.png', name: '[669] Arena ZR380 รถแต่งอารีน่า' },
      { emoji: '/blips/radar_security_van.png', name: '[67] Security Van รถขนเงิน / รถเกราะ' },
      { emoji: '/blips/radar_buyers_request.png', name: '[963] Buyers Request มาร์คร้านค้า / ร้านค้า / จุดรับซื้อ' },
      { emoji: '/blips/radar_pizza_this_orange.png', name: '[889] Pizza This ร้านอาหาร / จุดทำอาหารเอง - ส้ม (Orange)' },
      { emoji: '/blips/radar_pizza_this.png', name: '[889] Pizza This ร้านอาหาร / จุดทำอาหารเอง - ขาว (White)' },
    ],
  },
  {
    group: 'ขายยา & ของเถื่อน',
    icons: [
      { emoji: '/blips/radar_pickup_weed_green.png', name: '[469] Weed ใบกัญชา (เขียว) / จุดขายยา Dealer' },
      { emoji: '/blips/radar_pickup_weed.png', name: '[469] Weed ใบกัญชา (ขาว) / จุดขายยา Dealer' },
      { emoji: '/blips/radar_pickup_weed_yellow.png', name: '[469] Weed ใบกัญชา (เหลือง)' },
      { emoji: '/blips/radar_pickup_weed_red.png', name: '[469] Weed ใบกัญชา (แดง)' },
      { emoji: '/blips/radar_pickup_weed_purple.png', name: '[469] Weed ใบกัญชา (ม่วง Purple Haze)' },
      { emoji: '/blips/radar_pickup_weed_cyan.png', name: '[469] Weed ใบกัญชา (ฟ้า Cyan)' },
      { emoji: '/blips/radar_pickup_weed_orange.png', name: '[469] Weed ใบกัญชา (ส้ม)' },
      { emoji: '/blips/radar_contraband_gray.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - เทา' },
      { emoji: '/blips/radar_contraband_white.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ขาว' },
      { emoji: '/blips/radar_contraband_yellow.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - เหลือง' },
      { emoji: '/blips/radar_contraband_pink.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ชมพู' },
      { emoji: '/blips/radar_contraband_brown.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - น้ำตาล' },
      { emoji: '/blips/radar_contraband.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ปกติ' },
      { emoji: '/blips/radar_crim_cuff_keys_red.png', name: '[134] Cuff Keys กุญแจมือ - แดง' },
      { emoji: '/blips/radar_crim_cuff_keys.png', name: '[134] Cuff Keys กุญแจมือ - ขาว' },
      { emoji: '/blips/radar_handcuff_keys_bikers_red.png', name: '[186] Handcuff Keys กุญแจมือไข - แดง' },
      { emoji: '/blips/radar_handcuff_keys_bikers.png', name: '[186] Handcuff Keys กุญแจมือไข - ขาว' },
    ],
  },
  {
    group: 'แลนด์มาร์ค & เควส',
    icons: [
      { emoji: '/blips/radar_player_king_white.png', name: '[439] King มงกุฎ - ขาว (White)' },
      { emoji: '/blips/radar_player_king_yellow.png', name: '[439] King มงกุฎ - เหลือง (Yellow)' },
      { emoji: '/blips/radar_player_king_red.png', name: '[439] King มงกุฎ - แดง (Red)' },
      { emoji: '/blips/radar_player_king_orange.png', name: '[439] King มงกุฎ - ส้ม (Orange)' },
      { emoji: '/blips/radar_player_king_green.png', name: '[439] King มงกุฎ - เขียว (Green)' },
      { emoji: '/blips/radar_player_king_cyan.png', name: '[439] King มงกุฎ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_player_king_blue.png', name: '[439] King มงกุฎ - น้ำเงิน (Blue)' },
      { emoji: '/blips/radar_player_king_mint.png', name: '[439] King มงกุฎ - มิ้นต์ (Mint)' },
      { emoji: '/blips/radar_player_king_purple.png', name: '[439] King มงกุฎ - ม่วง (Purple)' },
      { emoji: '/blips/radar_player_king_brown.png', name: '[439] King มงกุฎ - น้ำตาล (Brown)' },
      { emoji: '/blips/radar_player_king_pink.png', name: '[439] King มงกุฎ - ชมพู (Pink)' },
      { emoji: '/blips/radar_friend_yellow.png', name: '[280] Friend เควส / เพื่อน - เหลือง (Yellow)' },
      { emoji: '/blips/radar_friend_pink.png', name: '[280] Friend เควส / เพื่อน - ชมพู (Pink)' },
      { emoji: '/blips/radar_friend_green.png', name: '[280] Friend เควส / เพื่อน - เขียว (Green)' },
      { emoji: '/blips/radar_friend_red.png', name: '[280] Friend เควส / เพื่อน - แดง (Red)' },
      { emoji: '/blips/radar_friend.png', name: '[280] Friend เควส / เพื่อน - ขาว (White)' },
      { emoji: '/blips/radar_ugc_mission_yellow.png', name: '[304] UGC Mission ภารกิจ / ดาว - เหลือง' },
      { emoji: '/blips/radar_ugc_mission.png', name: '[304] UGC Mission ภารกิจ / ดาว - ขาว' },
    ],
  },
  {
    group: 'ยานยนต์ & แข่งรถ',
    icons: [
      { emoji: '/blips/radar_race_land_purple.png', name: '[315] Race Land แข่งรถทางบก - ม่วง' },
      { emoji: '/blips/radar_race_land.png', name: '[315] Race Land แข่งรถทางบก - ขาว' },
      { emoji: '/blips/radar_bennys_blue.png', name: "[446] Benny's อู่แต่งรถ - น้ำเงิน" },
      { emoji: '/blips/radar_bennys.png', name: "[446] Benny's อู่แต่งรถ - ขาว" },
      { emoji: '/blips/radar_pickup_repair_red.png', name: '[544] Pickup Repair อู่ซ่อม - แดง' },
      { emoji: '/blips/radar_pickup_repair.png', name: '[544] Pickup Repair อู่ซ่อม - ขาว' },
      { emoji: '/blips/radar_gang_vehicle_yellow.png', name: '[225] Gang Vehicle รถแก๊ง - เหลือง' },
      { emoji: '/blips/radar_gang_vehicle_red.png', name: '[225] Gang Vehicle รถแก๊ง - แดง' },
      { emoji: '/blips/radar_gang_vehicle.png', name: '[225] Gang Vehicle รถแก๊ง - ขาว' },
      { emoji: '/blips/radar_arena_zr380.png', name: '[669] Arena ZR380 รถแต่งอารีน่า' },
      { emoji: '/blips/radar_security_van.png', name: '[67] Security Van รถขนเงิน / รถเกราะ' },
      { emoji: '/blips/radar_jerry_can.png', name: '[361] Jerry Can แกลลอนน้ำมัน' },
    ],
  },
  {
    group: 'รีหัว, บาร์ & บริการ',
    icons: [
      { emoji: '/blips/radar_bar_pink.png', name: '[93] Bar รีหัว / บาร์เหล้า - ชมพู' },
      { emoji: '/blips/radar_bar_green.png', name: '[93] Bar รีหัว / บาร์เหล้า - เขียว' },
      { emoji: '/blips/radar_bar_purple.png', name: '[93] Bar รีหัว / บาร์เหล้า - ม่วง' },
      { emoji: '/blips/radar_bar.png', name: '[93] Bar รีหัว / บาร์เหล้า - ขาว' },
      { emoji: '/blips/radar_biker_bar_purple.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ - ม่วง' },
      { emoji: '/blips/radar_biker_bar.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ - ขาว' },
      { emoji: '/blips/radar_hospital_green.png', name: '[61] Hospital โรงพยาบาล - เขียว' },
      { emoji: '/blips/radar_hospital.png', name: '[61] Hospital โรงพยาบาล - ขาว' },
      { emoji: '/blips/radar_police_station_cyan.png', name: '[60] Police Station สถานีตำรวจ - ฟ้า' },
      { emoji: '/blips/radar_police_station.png', name: '[60] Police Station สถานีตำรวจ - ขาว' },
      { emoji: '/blips/radar_barber_green.png', name: '[71] Barber ร้านตัดผม - เขียว' },
      { emoji: '/blips/radar_barber.png', name: '[71] Barber ร้านตัดผม - ขาว' },
      { emoji: '/blips/radar_clothes_store_red.png', name: '[73] Clothes Store ร้านเสื้อผ้า - แดง' },
      { emoji: '/blips/radar_clothes_store.png', name: '[73] Clothes Store ร้านเสื้อผ้า - ขาว' },
      { emoji: '/blips/radar_tattoo.png', name: '[75] Tattoo ร้านสักลาย' },
      { emoji: '/blips/radar_mask_cyan.png', name: '[362] Mask ร้านหน้ากาก - ฟ้า' },
      { emoji: '/blips/radar_mask.png', name: '[362] Mask ร้านหน้ากาก - ขาว' },
      { emoji: '/blips/radar_buyers_request.png', name: '[963] Buyers Request มาร์คร้านค้า / ร้านค้า / จุดรับซื้อ' },
      { emoji: '/blips/radar_pizza_this_orange.png', name: '[889] Pizza This ร้านอาหาร / จุดทำอาหารเอง - ส้ม' },
      { emoji: '/blips/radar_pizza_this.png', name: '[889] Pizza This ร้านอาหาร / จุดทำอาหารเอง - ขาว' },
    ],
  },
  {
    group: 'โกดัง, ออฟฟิศ & บังเกอร์',
    icons: [
      { emoji: '/blips/radar_warehouse_vehicle_yellow.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - เหลือง' },
      { emoji: '/blips/radar_warehouse_vehicle.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - ปกติ' },
      { emoji: '/blips/radar_office_cyan.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ฟ้า' },
      { emoji: '/blips/radar_office.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ขาว' },
      { emoji: '/blips/radar_adversary_bunker_gray.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - เทา' },
      { emoji: '/blips/radar_adversary_bunker.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - ขาว' },
      { emoji: '/blips/radar_garbage_cyan.png', name: '[318] Garbage ถังขยะ / รถขยะ - ฟ้า' },
      { emoji: '/blips/radar_garbage_gray.png', name: '[318] Garbage ถังขยะ / รถขยะ - เทา' },
      { emoji: '/blips/radar_garbage_orange.png', name: '[318] Garbage ถังขยะ / รถขยะ - ส้ม' },
      { emoji: '/blips/radar_garbage_yellow.png', name: '[318] Garbage ถังขยะ / รถขยะ - เหลือง' },
      { emoji: '/blips/radar_garbage.png', name: '[318] Garbage ถังขยะ / รถขยะ - ปกติ' },
    ],
  },
];

export const ALL_FLAT_ICONS = ICON_CATEGORIES.flatMap((cat) =>
  cat.icons.map((item) => ({ ...item, group: cat.group }))
);

export const PRESET_COLORS = [
  { hex: '#f59e0b', name: 'ส้มปูน (Amber)' },
  { hex: '#ef4444', name: 'แดง (Red)' },
  { hex: '#3b82f6', name: 'น้ำเงิน (Blue)' },
  { hex: '#22c55e', name: 'เขียว (Green)' },
  { hex: '#eab308', name: 'เหลือง (Yellow)' },
  { hex: '#ec4899', name: 'ชมพู (Pink)' },
  { hex: '#a855f7', name: 'ม่วง (Purple)' },
  { hex: '#2dd4bf', name: 'มิ้นท์ (Mint)' },
  { hex: '#06b6d4', name: 'ฟ้า (Cyan)' },
  { hex: '#b45309', name: 'น้ำตาล (Brown)' },
  { hex: '#ffffff', name: 'ขาว (White)' },
  { hex: '#334155', name: 'เทาเข้ม (Slate)' },
];

export function renderSpotIcon(icon: string, className = 'w-5 h-5') {
  if (isImageIconString(icon)) {
    const safeUrl = sanitizeIconUrl(icon);
    return (
      <img
        src={safeUrl}
        alt=""
        aria-hidden="true"
        className={`${className} object-contain inline-block select-none pointer-events-none drop-shadow-sm`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <span className="leading-none inline-block select-none" aria-hidden="true">{icon || '📍'}</span>;
}

export function renderSpotIconHtml(icon: string, sizeClass = 'w-4 h-4'): string {
  if (isImageIconString(icon)) {
    const safeUrl = escapeHtml(sanitizeIconUrl(icon));
    const safeClass = escapeHtml(sizeClass);
    return `<img src="${safeUrl}" alt="" class="${safeClass} object-contain inline-block pointer-events-none select-none" loading="lazy" />`;
  }
  return `<span class="leading-none inline-block">${escapeHtml(icon || '📍')}</span>`;
}
