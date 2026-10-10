import { useState, useEffect, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { X, Clock, Package, AlertCircle, Wrench, Hash, Sparkles, ClipboardPaste, Check, Lock, Crown, Tag } from 'lucide-react';
import type { CementSpot } from '../types/map';
import { DEFAULT_SPOTS, isCementSpot } from '../data/defaultSpots';
import { parseFiveMCoords } from '../utils/crs';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spot: CementSpot) => void;
  initialSpot?: Partial<CementSpot> | null;
  onDelete?: (id: string) => void;
  isMaster?: boolean;
}

export function resolveAssetUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = import.meta.env.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = url.startsWith('/') ? url.slice(1) : url;
  return `${cleanBase}${cleanPath}`;
}

export function renderSpotIcon(icon: string, className: string = 'w-5 h-5') {
  if (!icon) return <span>🧱</span>;
  if (icon.startsWith('/') || icon.startsWith('http') || icon.endsWith('.png')) {
    return (
      <img
        src={resolveAssetUrl(icon)}
        alt=""
        className={`${className} object-contain inline-block pointer-events-none drop-shadow-sm align-middle`}
      />
    );
  }
  return <span className="inline-block leading-none align-middle">{icon}</span>;
}

// คลังไอคอน FiveM Blips ทางการ (https://docs.fivem.net/docs/game-references/blips/)
const ICON_CATEGORIES = [
  {
    group: '⭐ ทั้งหมด (FiveM Blips)',
    icons: [
      // 469 Weed Pickup / Drug Dealer
      { emoji: '/blips/radar_pickup_weed_green.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - เขียว (Green)' },
      { emoji: '/blips/radar_pickup_weed.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ขาว (White)' },
      { emoji: '/blips/radar_pickup_weed_yellow.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - เหลือง (Yellow)' },
      { emoji: '/blips/radar_pickup_weed_red.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - แดง (Red)' },
      { emoji: '/blips/radar_pickup_weed_purple.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ม่วง (Purple)' },
      { emoji: '/blips/radar_pickup_weed_cyan.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_pickup_weed_orange.png', name: '[469] Weed ใบกัญชา / ขายยา Dealer - ส้ม (Orange)' },

      // 439 King
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

      // 280 Friend
      { emoji: '/blips/radar_friend_yellow.png', name: '[280] Friend เพื่อน / ทีม / เควส - เหลือง (Yellow)' },
      { emoji: '/blips/radar_friend_pink.png', name: '[280] Friend เพื่อน / ทีม - ชมพู (Pink)' },
      { emoji: '/blips/radar_friend_green.png', name: '[280] Friend เพื่อน / ทีม - เขียว (Green)' },
      { emoji: '/blips/radar_friend_red.png', name: '[280] Friend เพื่อน / ทีม - แดง (Red)' },
      { emoji: '/blips/radar_friend.png', name: '[280] Friend เพื่อน / ทีม - ขาว (White)' },

      // 478 Contraband
      { emoji: '/blips/radar_contraband_gray.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - เทา (Gray)' },
      { emoji: '/blips/radar_contraband_white.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ขาว (White)' },
      { emoji: '/blips/radar_contraband_yellow.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - เหลือง (Yellow)' },
      { emoji: '/blips/radar_contraband_pink.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ชมพู (Pink)' },
      { emoji: '/blips/radar_contraband_brown.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - น้ำตาล (Brown)' },
      { emoji: '/blips/radar_contraband.png', name: '[478] Contraband ฟาร์ม / ของเถื่อน - ปกติ' },

      // 93 Bar
      { emoji: '/blips/radar_bar_pink.png', name: '[93] Bar รีหัว / บาร์เหล้า - ชมพู (Pink)' },
      { emoji: '/blips/radar_bar_green.png', name: '[93] Bar รีหัว / บาร์เหล้า - เขียว (Green)' },
      { emoji: '/blips/radar_bar_purple.png', name: '[93] Bar รีหัว / บาร์เหล้า - ม่วง (Purple)' },
      { emoji: '/blips/radar_bar.png', name: '[93] Bar รีหัว / บาร์เหล้า - ขาว (White)' },

      // 827 Biker Bar
      { emoji: '/blips/radar_biker_bar_purple.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ / ขวดเหล้า - ม่วง (Purple)' },
      { emoji: '/blips/radar_biker_bar.png', name: '[827] Biker Bar บาร์ไบค์เกอร์ / ขวดเหล้า - ขาว (White)' },

      // 315 Race Land
      { emoji: '/blips/radar_race_land_purple.png', name: '[315] Race Land แข่งรถทางบก - ม่วง (Purple)' },
      { emoji: '/blips/radar_race_land.png', name: '[315] Race Land แข่งรถทางบก - ขาว (White)' },

      // 446 Benny's Motorworks
      { emoji: '/blips/radar_bennys_blue.png', name: "[446] Benny's อู่แต่งรถ / ไขควงประแจ - น้ำเงิน (Blue)" },
      { emoji: '/blips/radar_bennys.png', name: "[446] Benny's อู่แต่งรถ / ไขควงประแจ - ขาว (White)" },

      // 544 Pickup Repair
      { emoji: '/blips/radar_pickup_repair_red.png', name: '[544] Pickup Repair ประแจซ่อม / อู่ซ่อม - แดง (Red)' },
      { emoji: '/blips/radar_pickup_repair.png', name: '[544] Pickup Repair ประแจซ่อม / อู่ซ่อม - ขาว (White)' },

      // 134 Crim Cuff Keys & 186 Handcuff Keys
      { emoji: '/blips/radar_crim_cuff_keys_red.png', name: '[134] Cuff Keys กุญแจมือ - แดง (Red)' },
      { emoji: '/blips/radar_crim_cuff_keys.png', name: '[134] Cuff Keys กุญแจมือ - ขาว (White)' },
      { emoji: '/blips/radar_handcuff_keys_bikers_red.png', name: '[186] Handcuff Keys กุญแจมือไข - แดง (Red)' },
      { emoji: '/blips/radar_handcuff_keys_bikers.png', name: '[186] Handcuff Keys กุญแจมือไข - ขาว (White)' },

      // 61 Hospital & 60 Police
      { emoji: '/blips/radar_hospital_green.png', name: '[61] Hospital โรงพยาบาล / หมอ - เขียว (Green)' },
      { emoji: '/blips/radar_hospital.png', name: '[61] Hospital โรงพยาบาล - ปกติ' },
      { emoji: '/blips/radar_police_station_cyan.png', name: '[60] Police Station สถานีตำรวจ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_police_station.png', name: '[60] Police Station สถานีตำรวจ - ปกติ' },

      // 361 Jerry Can
      { emoji: '/blips/radar_jerry_can.png', name: '[361] Jerry Can แกลลอนน้ำมัน' },

      // 524 Warehouse & 475 Office & 565 Bunker
      { emoji: '/blips/radar_warehouse_vehicle_yellow.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - เหลือง' },
      { emoji: '/blips/radar_warehouse_vehicle.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - ปกติ' },
      { emoji: '/blips/radar_office_cyan.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_office.png', name: '[475] Office ออฟฟิศ / สำนักงาน - ขาว (White)' },
      { emoji: '/blips/radar_adversary_bunker_gray.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - เทา (Gray)' },
      { emoji: '/blips/radar_adversary_bunker.png', name: '[565] Bunker บังเกอร์ / หลุมหลบภัย - ขาว (White)' },

      // 318 Garbage
      { emoji: '/blips/radar_garbage_cyan.png', name: '[318] Garbage ถังขยะ / รถขยะ - ฟ้า (Cyan)' },
      { emoji: '/blips/radar_garbage_gray.png', name: '[318] Garbage ถังขยะ / รถขยะ - เทา (Gray)' },
      { emoji: '/blips/radar_garbage_orange.png', name: '[318] Garbage ถังขยะ / รถขยะ - ส้ม (Orange)' },
      { emoji: '/blips/radar_garbage_yellow.png', name: '[318] Garbage ถังขยะ / รถขยะ - เหลือง (Yellow)' },
      { emoji: '/blips/radar_garbage.png', name: '[318] Garbage ถังขยะ / รถขยะ - ปกติ' },

      // 304 UGC Mission & 362 Mask & 71 Barber & 73 Clothes & 75 Tattoo & Vehicles
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

// สีหมุดยอดนิยมสไตล์ FiveM
const PRESET_COLORS = [
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

export interface SpotTypeOption {
  id: string;
  label: string;
  icon: string;
  defaultColor: string;
  defaultIcon: string;
  hint: string;
}

export const SPOT_TYPES: SpotTypeOption[] = [
  {
    id: 'cement_mine',
    label: 'จุดปูน (Cement)',
    icon: '🧱',
    defaultColor: '#f59e0b',
    defaultIcon: '🧱',
    hint: 'จุดฟาร์ม/ขุดปูน (นับในระบบปูน)',
  },
  {
    id: 'race',
    label: 'แข่งรถ (Race)',
    icon: '🏁',
    defaultColor: '#a855f7',
    defaultIcon: '/blips/radar_race_land_purple.png',
    hint: 'จุดแข่งรถ/สนามแข่ง',
  },
  {
    id: 'head_reset',
    label: 'รีหัว (Head Reset)',
    icon: '🍸',
    defaultColor: '#ec4899',
    defaultIcon: '/blips/radar_bar_pink.png',
    hint: 'จุดรีหัว/บาร์เหล้า (Blip 93)',
  },
  {
    id: 'farm',
    label: 'ฟาร์ม (Farm)',
    icon: '📦',
    defaultColor: '#f59e0b',
    defaultIcon: '/blips/radar_contraband.png',
    hint: 'จุดฟาร์ม/ของเถื่อน (Blip 478)',
  },
  {
    id: 'quest',
    label: 'เควส (Quest)',
    icon: '⭐',
    defaultColor: '#eab308',
    defaultIcon: '/blips/radar_friend_yellow.png',
    hint: 'จุดเควส/ภารกิจ (Blip 280)',
  },
  {
    id: 'landmark',
    label: 'แลนด์มาร์ค (Landmark)',
    icon: '👑',
    defaultColor: '#38bdf8',
    defaultIcon: '/blips/radar_player_king_white.png',
    hint: 'แลนด์มาร์ค/จุดนัดพบ',
  },
  {
    id: 'dealer',
    label: 'จุดขายยา (Dealer)',
    icon: '🌿',
    defaultColor: '#22c55e',
    defaultIcon: '/blips/radar_pickup_weed_green.png',
    hint: 'จุดส่งยา/ขายยา',
  },
  {
    id: 'fuel',
    label: 'ปั๊มน้ำมัน (Fuel)',
    icon: '⛽',
    defaultColor: '#06b6d4',
    defaultIcon: '/blips/radar_jerry_can.png',
    hint: 'จุดเติมน้ำมัน',
  },
  {
    id: 'services',
    label: 'บริการ/ทั่วไป (Services)',
    icon: '🏥',
    defaultColor: '#10b981',
    defaultIcon: '/blips/radar_hospital.png',
    hint: 'โรงพยาบาล/สถานที่บริการ',
  },
];

const officialSpotIds = new Set(DEFAULT_SPOTS.map((s) => s.id));

export const PinModal = ({
  isOpen,
  onClose,
  onSave,
  initialSpot,
  onDelete,
  isMaster = false,
}: PinModalProps) => {
  const isOfficial = Boolean(initialSpot?.id && officialSpotIds.has(initialSpot.id));
  const [category, setCategory] = useState<string>('cement_mine');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🧱');
  const [color, setColor] = useState('#f59e0b');
  const [activeGroup, setActiveGroup] = useState('ทั้งหมด');
  const [iconSearch, setIconSearch] = useState('');
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);
  const [z, setZ] = useState<number>(30.0);
  const [postal, setPostal] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState(10);
  const [yieldDescription, setYieldDescription] = useState('');
  const [requiredItemsStr, setRequiredItemsStr] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [coordsPasteInput, setCoordsPasteInput] = useState('');
  const [coordsPasteStatus, setCoordsPasteStatus] = useState<string | null>(null);

  const handleAddTag = (t: string) => {
    let clean = t.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleTogglePresetTag = (preset: string) => {
    if (tags.includes(preset)) {
      handleRemoveTag(preset);
    } else {
      handleAddTag(preset);
    }
  };

  const handleCoordsPaste = (raw: string) => {
    setCoordsPasteInput(raw);
    const parsed = parseFiveMCoords(raw);
    if (parsed) {
      setX(parsed.x);
      setY(parsed.y);
      setZ(parsed.z);
      setCoordsPasteStatus(`✓ พิกัด X: ${parsed.x}, Y: ${parsed.y}, Z: ${parsed.z}`);
      setTimeout(() => setCoordsPasteStatus(null), 3000);
    }
  };

  // Flattened all icons for search
  const allIcons = useMemo(() => {
    return ICON_CATEGORIES.flatMap((c) => c.icons.map((i) => ({ ...i, group: c.group })));
  }, []);

  const filteredIcons = useMemo(() => {
    let list = allIcons;
    if (activeGroup !== 'ทั้งหมด') {
      list = list.filter((i) => i.group === activeGroup);
    }
    if (iconSearch.trim()) {
      const q = iconSearch.toLowerCase().trim();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.emoji.toLowerCase().includes(q));
    }
    return list;
  }, [allIcons, activeGroup, iconSearch]);

  useEffect(() => {
    setCoordsPasteInput('');
    setCoordsPasteStatus(null);
    setTagInput('');
    if (initialSpot) {
      setName(initialSpot.name || '');
      const isCement = isCementSpot(initialSpot as CementSpot);
      const isDrug =
        initialSpot.category === 'dealer' ||
        initialSpot.name?.includes('ขายยา') ||
        initialSpot.tags?.includes('dealer') ||
        initialSpot.tags?.includes('จุดขายยา');
      const isFuelSpot =
        initialSpot.category === 'fuel' ||
        initialSpot.name?.includes('น้ำมัน') ||
        initialSpot.icon?.includes('jerry_can');
      const isServicesSpot =
        initialSpot.category === 'services' ||
        initialSpot.category === 'hospital' ||
        initialSpot.category === 'police';

      let determinedCat = initialSpot.category || 'landmark';
      if (!initialSpot.category || initialSpot.category === 'landmark') {
        if (isCement) determinedCat = 'cement_mine';
        else if (isDrug) determinedCat = 'dealer';
        else if (isFuelSpot) determinedCat = 'fuel';
        else if (isServicesSpot) determinedCat = 'services';
      }
      setCategory(determinedCat);
      setIcon(initialSpot.icon || (determinedCat === 'cement_mine' ? '🧱' : '/blips/radar_player_king_white.png'));
      setColor(initialSpot.color || (determinedCat === 'cement_mine' ? '#f59e0b' : '#38bdf8'));
      setX(initialSpot.x !== undefined ? initialSpot.x : 0);
      setY(initialSpot.y !== undefined ? initialSpot.y : 0);
      setZ(initialSpot.z !== undefined ? initialSpot.z : 30.0);
      setPostal(initialSpot.postal || '');
      setCooldownMinutes(initialSpot.cooldownMinutes ?? 10);
      setYieldDescription(initialSpot.yieldDescription || '');
      setRequiredItemsStr(initialSpot.requiredItems ? initialSpot.requiredItems.join(', ') : '');
      setNotes(initialSpot.notes || '');
      setTags(initialSpot.tags || []);
    } else {
      setName('');
      setCategory('cement_mine');
      setIcon('🧱');
      setColor('#f59e0b');
      setX(0);
      setY(0);
      setZ(30.0);
      setPostal('');
      setCooldownMinutes(10);
      setYieldDescription('');
      setRequiredItemsStr('');
      setNotes('');
      setTags([]);
    }
  }, [initialSpot, isOpen]);

  const handleSelectCategory = (newCat: string) => {
    setCategory(newCat);
    const chosenType = SPOT_TYPES.find((t) => t.id === newCat);
    if (chosenType) {
      const isCurrentIconDefault = SPOT_TYPES.some((t) => t.defaultIcon === icon);
      if (isCurrentIconDefault || !icon) {
        setIcon(chosenType.defaultIcon);
        setColor(chosenType.defaultColor);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const items = requiredItemsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const numX = Number(x);
    const numY = Number(y);
    const numZ = Number(z);
    const safeX = Number.isFinite(numX) ? numX : 0;
    const safeY = Number.isFinite(numY) ? numY : 0;
    const safeZ = Number.isFinite(numZ) ? numZ : 30.0;
    const safeCd = Math.max(0, parseInt(String(cooldownMinutes), 10) || 0);

    const trimmedName = name.trim();

    const updated: CementSpot = {
      id: initialSpot?.id || `spot-${Date.now()}`,
      name: trimmedName,
      category,
      icon: icon.trim() || (category === 'cement_mine' ? '🧱' : '/blips/radar_player_king_white.png'),
      color,
      x: safeX,
      y: safeY,
      z: safeZ,
      postal: postal.trim(),
      cooldownMinutes: safeCd,
      yieldDescription: yieldDescription.trim(),
      requiredItems: items,
      notes: notes.trim(),
      tags: tags.length > 0 ? tags : undefined,
      createdAt: initialSpot?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(updated);
    onClose();
  };

  const mountTimeRef = useRef(Date.now());
  useEffect(() => {
    if (isOpen) {
      mountTimeRef.current = Date.now();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && Date.now() - mountTimeRef.current > 300) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg border"
              style={{ backgroundColor: `${color}22`, borderColor: color }}
            >
              {renderSpotIcon(icon, 'w-6 h-6')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {initialSpot?.id ? 'แก้ไขหมุดมาร์คเกอร์' : 'สร้างหมุดใหม่บนแผนที่'}
                </h2>
                {isOfficial && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>จุดหลักของแก๊ง</span>
                  </span>
                )}
                {isOfficial && isMaster && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 font-bold">
                    <Crown className="w-3 h-3 text-red-400" />
                    <span>หัวหน้า</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isOfficial && !isMaster
                  ? 'หมุดหลักทางการของแก๊ง พิกัดจะถูกล็อคไว้เพื่อความปลอดภัย'
                  : 'ตั้งชื่อหมุดและเลือกไอคอนตามต้องการได้อย่างอิสระ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* 1. หมวดหมู่ / ประเภทมาร์ค (Marker Category) */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>1. ประเภทมาร์ค (หมวดหมู่) *</span>
              </label>
              <span className="text-[11px] font-semibold text-amber-400">
                {SPOT_TYPES.find((t) => t.id === category)?.label || 'กำหนดเอง'}
              </span>
            </div>

            {/* Quick Type Selection Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPOT_TYPES.map((type) => {
                const isSelected = category === type.id;
                return (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => handleSelectCategory(type.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10 scale-[1.02]'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-lg leading-none shrink-0">{type.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">{type.label}</div>
                      <div className="text-[10px] text-slate-400 truncate leading-tight">{type.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. ชื่อจุด / ชื่อเรียกในแก๊ง */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                2. ชื่อจุด / ชื่อเรียกในแก๊ง *
              </label>
              {category === 'cement_mine' && (
                <span className="text-[11px] text-amber-300 font-semibold bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-500/30">
                  🧱 ระบบนับเป็นจุดปูน
                </span>
              )}
            </div>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                category === 'cement_mine'
                  ? 'เช่น ปูนริมหาด, ปูน 1, ปูนสะพาน, ปูนท่าเรือ...'
                  : category === 'dealer'
                  ? 'เช่น จุดขายยา, แลนน้ำตาล, ขายยาสะพาน...'
                  : 'เช่น แลนด์มาร์ค, ปั๊มน้ำมัน...'
              }
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm font-medium"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {category === 'cement_mine'
                ? '💡 สามารถเปลี่ยนชื่อปูนให้เพื่อนรู้ตำแหน่งได้อิสระ (เช่น "ปูน 1", "ปูนสะพาน") โดยระบบจะยังนับเป็นจุดปูนเสมอ'
                : '💡 ตั้งชื่อสถานที่ให้เพื่อนในแก๊งเข้าใจง่ายและเรียกพิกัดได้ถูกต้อง'}
            </p>
          </div>

          {/* 2. เลือกไอคอน (Icon Picker) */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>3. เลือกไอคอนหมุด</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/30">
                <span className="text-base flex items-center justify-center">{renderSpotIcon(icon, 'w-5 h-5')}</span>
                <span>ไอคอนที่เลือก</span>
              </div>
            </div>

            {/* Custom Emoji Input & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 overflow-hidden">
                <span className="text-xs text-slate-400 shrink-0">ไอคอน/อิโมจิ:</span>
                {icon.startsWith('/') || icon.endsWith('.png') ? (
                  <span className="text-[11px] text-amber-300 font-mono truncate" title={icon}>
                    {icon.split('/').pop()}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value.trim() || '🧱')}
                    placeholder="เช่น 🧱 หรือ /blips/..."
                    maxLength={50}
                    className="w-24 bg-transparent text-center text-sm font-bold text-white focus:outline-none"
                  />
                )}
              </div>

              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="🔍 ค้นหาไอคอน (เช่น 439, มงกุฎ, ตำรวจ, รถ)..."
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
              {['ทั้งหมด', ...ICON_CATEGORIES.map((c) => c.group)].map((grp) => (
                <button
                  type="button"
                  key={grp}
                  onClick={() => setActiveGroup(grp)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-all font-medium text-[11px] ${
                    activeGroup === grp
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>

            {/* Grid of Emojis & Blips */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredIcons.map((item, idx) => {
                const isSelected = icon === item.emoji;
                return (
                  <button
                    type="button"
                    key={`${item.emoji}-${idx}`}
                    onClick={() => {
                      setIcon(item.emoji);
                      if (item.emoji.includes('_purple')) setColor('#a855f7');
                      else if (item.emoji.includes('_red')) setColor('#ef4444');
                      else if (item.emoji.includes('_pink')) setColor('#ec4899');
                      else if (item.emoji.includes('_yellow')) setColor('#eab308');
                      else if (item.emoji.includes('_green')) setColor('#22c55e');
                      else if (item.emoji.includes('_cyan')) setColor('#06b6d4');
                      else if (item.emoji.includes('_blue')) setColor('#3b82f6');
                      else if (item.emoji.includes('_orange')) setColor('#f97316');
                      else if (item.emoji.includes('_brown')) setColor('#b45309');
                      else if (item.emoji.includes('_mint')) setColor('#2dd4bf');
                      else if (item.emoji.includes('_gray')) setColor('#9ca3af');
                    }}
                    title={item.name}
                    className={`h-11 rounded-xl flex items-center justify-center text-xl transition-all ${
                      isSelected
                        ? 'bg-amber-400/30 border-2 border-amber-400 scale-110 shadow-lg shadow-amber-400/20'
                        : 'bg-slate-800/80 border border-slate-700/60 hover:bg-slate-750 hover:scale-105'
                    }`}
                  >
                    {renderSpotIcon(item.emoji, 'w-6 h-6')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. เลือกสีหมุด (Marker Color) + Live Preview */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                4. เลือกสีหมุด (Marker Color)
              </label>
              <span className="text-[11px] font-mono text-slate-400">{color}</span>
            </div>

            {/* Color Swatches */}
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={`w-7 h-7 rounded-full transition-transform border-2 ${
                    color.toLowerCase() === c.hex.toLowerCase()
                      ? 'scale-125 border-white shadow-lg'
                      : 'border-slate-800 hover:scale-110 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}

              {/* Custom Color Input */}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            {/* Live Marker Preview Box */}
            <div className="flex items-center gap-3.5 pt-2 border-t border-slate-800/80">
              <div className="text-xs text-slate-400 font-medium">ตัวอย่างหมุดบนแผนที่:</div>
              <div className="flex items-center gap-2.5 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
                <div className="flex flex-col items-center">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-xl border-2"
                    style={{
                      backgroundColor: color,
                      borderColor: '#ffffff',
                    }}
                  >
                    {renderSpotIcon(icon, 'w-4 h-4')}
                  </div>
                  <div
                    className="w-0 h-0 border-x-4 border-x-transparent border-t-[5px] -mt-0.5"
                    style={{ borderTopColor: color }}
                  />
                </div>
                <span className="font-bold text-xs text-white truncate max-w-[200px]">
                  {name || 'ชื่อหมุดของคุณ'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. พิกัด X, Y, Z และ Postal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                5. ตำแหน่งพิกัดในเกม FiveM
              </label>
              {coordsPasteStatus && (
                <span className="text-[11px] text-emerald-400 font-bold animate-pulse flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{coordsPasteStatus}</span>
                </span>
              )}
            </div>

            {/* Quick Paste Vector3 / Coords Bar */}
            <div className="mb-2.5 p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="text"
                value={coordsPasteInput}
                onChange={(e) => handleCoordsPaste(e.target.value)}
                placeholder="วางพิกัดจาก FiveM ทันที เช่น vector3(-154.2, -1035.8, 30.5) หรือ /tp ..."
                className="flex-1 bg-transparent text-xs font-mono text-emerald-400 placeholder:text-slate-500 focus:outline-none"
              />
              {coordsPasteInput && (
                <button
                  type="button"
                  onClick={() => setCoordsPasteInput('')}
                  className="text-slate-400 hover:text-white p-1 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  พิกัด X (East/West)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={x}
                  onChange={(e) => setX(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-emerald-400 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  พิกัด Y (North/South)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={y}
                  onChange={(e) => setY(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-emerald-400 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  พิกัด Z (ความสูง)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={z}
                  onChange={(e) => setZ(parseFloat(e.target.value) || 30)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-amber-400" />
                  <span>Postal Code</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น 8042"
                  value={postal}
                  onChange={(e) => setPostal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* 6. ข้อมูลเสริม (คูลดาวน์, ผลผลิต, หมายเหตุ) */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>เวลาคูลดาวน์: <strong className="text-amber-300 font-mono">{cooldownMinutes} นาที</strong></span>
                  </span>
                  <span className="text-[10px] text-slate-500">ปรับเวลาด่วน</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {/* NameThatUI Pattern: Stepper */}
                  <button
                    type="button"
                    onClick={() => setCooldownMinutes(Math.max(0, cooldownMinutes - 5))}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[11px] font-bold border border-slate-700"
                    title="ลด 5 นาที"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => setCooldownMinutes(Math.max(0, cooldownMinutes - 1))}
                    className="px-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[11px] font-bold border border-slate-700"
                    title="ลด 1 นาที"
                  >
                    -1
                  </button>

                  {/* NameThatUI Pattern: Slider */}
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
                    className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />

                  <button
                    type="button"
                    onClick={() => setCooldownMinutes(cooldownMinutes + 1)}
                    className="px-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[11px] font-bold border border-slate-700"
                    title="เพิ่ม 1 นาที"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setCooldownMinutes(cooldownMinutes + 5)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[11px] font-bold border border-slate-700"
                    title="เพิ่ม 5 นาที"
                  >
                    +5
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ผลผลิตที่ได้รับ / รางวัล</span>
                </label>
                <input
                  type="text"
                  value={yieldDescription}
                  onChange={(e) => setYieldDescription(e.target.value)}
                  placeholder="เช่น ปูนซีเมนต์ 8-15 ถุง, ไม้ 10 ท่อน"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-purple-400" />
                <span>ไอเทม / อุปกรณ์ที่ต้องใช้ (คั่นด้วยจุลภาค ,)</span>
              </label>
              <input
                type="text"
                value={requiredItemsStr}
                onChange={(e) => setRequiredItemsStr(e.target.value)}
                placeholder="เช่น พลั่วตักทราย, ถุงกระสอบ"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>บันทึกเพิ่มเติม / คำเตือน</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น จุดเกิดอยู่ข้างตึก, ระวังตำรวจตั้งด่าน..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:outline-none resize-none transition-all"
              />
            </div>

            {/* NameThatUI Pattern: Token Field (Tags / ฉลากกำกับหมุด) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>แท็กกำกับจุด (Token Field)</span>
                </span>
                <span className="text-[10px] text-slate-500">พิมพ์แล้วกด Enter หรือคลิกแท็กด่วน</span>
              </label>

              {/* Token Field Chips Container */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/70 border border-slate-800 rounded-xl min-h-[38px] focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:border-amber-400 transition-all">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-red-400 text-amber-400/70 ml-0.5 text-xs font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? "เช่น #โซนแดง, #ขายยา..." : "เพิ่มแท็ก..."}
                  className="flex-1 min-w-[100px] bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Preset Tokens */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-slate-500 text-[10px] mr-1">แท็กด่วน:</span>
                {['#จุดเสี่ยง', '#โซนแดง', '#ขายยา', '#ฟาร์มง่าย', '#ลับ', '#ตำรวจดัก', '#มีกล่อง', '#บอส'].map((preset) => {
                  const isAdded = tags.includes(preset);
                  return (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => handleTogglePresetTag(preset)}
                      className={`px-2 py-0.5 rounded-md transition-all font-mono text-[10px] border cursor-pointer ${
                        isAdded
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-400 shadow-sm'
                          : 'bg-slate-800/60 hover:bg-slate-750 text-slate-400 hover:text-white border-slate-700/60'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {initialSpot?.id && onDelete ? (
              isOfficial && !isMaster ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-400 select-none">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>จุดหลักของแก๊ง (เฉพาะหัวหน้าที่มีสิทธิ์ลบ)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('คุณต้องการลบหมุดนี้ใช่หรือไม่?')) {
                      onDelete(initialSpot.id!);
                      onClose();
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors border border-red-500/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isOfficial && isMaster && <Crown className="w-3.5 h-3.5 text-red-400" />}
                  <span>ลบหมุดนี้</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                บันทึกหมุด
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

