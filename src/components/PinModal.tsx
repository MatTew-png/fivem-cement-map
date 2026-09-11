import { useState, useEffect, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { X, Clock, Package, AlertCircle, Wrench, Hash, Sparkles, ClipboardPaste, Check } from 'lucide-react';
import type { CementSpot } from '../types/map';
import { parseFiveMCoords } from '../utils/crs';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spot: CementSpot) => void;
  initialSpot?: Partial<CementSpot> | null;
  onDelete?: (id: string) => void;
}

export function renderSpotIcon(icon: string, className: string = 'w-5 h-5') {
  if (!icon) return <span>🧱</span>;
  if (icon.startsWith('/') || icon.startsWith('http') || icon.endsWith('.png')) {
    return (
      <img
        src={icon}
        alt=""
        className={`${className} object-contain inline-block pointer-events-none drop-shadow-sm align-middle`}
      />
    );
  }
  return <span className="inline-block leading-none align-middle">{icon}</span>;
}

// คลังไอคอนยอดนิยมสำหรับ GTA V FiveM
const ICON_CATEGORIES = [
  {
    group: '⭐ FiveM Blips (ทางการ)',
    icons: [
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

      // 67 Security Van
      { emoji: '/blips/radar_security_van.png', name: '[67] Security Van รถขนเงิน / รถเกราะ' },

      // 669 Arena ZR380
      { emoji: '/blips/radar_arena_zr380.png', name: '[669] Arena ZR380 รถแต่งอารีน่า' },

      // 225 Gang Vehicle
      { emoji: '/blips/radar_gang_vehicle_yellow.png', name: '[225] Gang Vehicle รถแก๊ง - เหลือง' },
      { emoji: '/blips/radar_gang_vehicle_red.png', name: '[225] Gang Vehicle รถแก๊ง - แดง' },
      { emoji: '/blips/radar_gang_vehicle.png', name: '[225] Gang Vehicle รถแก๊ง - ปกติ' },

      // 71 Barber
      { emoji: '/blips/radar_barber_green.png', name: '[71] Barber ร้านตัดผม - เขียว' },
      { emoji: '/blips/radar_barber.png', name: '[71] Barber ร้านตัดผม - ปกติ' },

      // 73 Clothes Store
      { emoji: '/blips/radar_clothes_store_red.png', name: '[73] Clothes Store ร้านเสื้อผ้า - แดง' },
      { emoji: '/blips/radar_clothes_store.png', name: '[73] Clothes Store ร้านเสื้อผ้า - ปกติ' },

      // 75 Tattoo
      { emoji: '/blips/radar_tattoo.png', name: '[75] Tattoo ร้านสักลาย' },

      // 61 Hospital
      { emoji: '/blips/radar_hospital_green.png', name: '[61] Hospital โรงพยาบาล / หมอ - เขียว' },
      { emoji: '/blips/radar_hospital.png', name: '[61] Hospital โรงพยาบาล - ปกติ' },

      // 60 Police Station
      { emoji: '/blips/radar_police_station_cyan.png', name: '[60] Police Station สถานีตำรวจ - ฟ้า' },
      { emoji: '/blips/radar_police_station.png', name: '[60] Police Station สถานีตำรวจ - ปกติ' },

      // 524 Warehouse Vehicle
      { emoji: '/blips/radar_warehouse_vehicle_yellow.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - เหลือง' },
      { emoji: '/blips/radar_warehouse_vehicle.png', name: '[524] Warehouse Vehicle โกดังเก็บรถ - ปกติ' },

      // 361 Jerry Can
      { emoji: '/blips/radar_jerry_can.png', name: '[361] Jerry Can แกลลอนน้ำมัน' },

      // 478 Contraband
      { emoji: '/blips/radar_contraband_white.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ขาว' },
      { emoji: '/blips/radar_contraband_yellow.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - เหลือง' },
      { emoji: '/blips/radar_contraband_pink.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ชมพู' },
      { emoji: '/blips/radar_contraband_brown.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - น้ำตาล' },
      { emoji: '/blips/radar_contraband.png', name: '[478] Contraband ของเถื่อน / กล่องดำ - ปกติ' },

      // 318 Garbage
      { emoji: '/blips/radar_garbage_gray.png', name: '[318] Garbage ถังขยะ / รถขยะ - เทา' },
      { emoji: '/blips/radar_garbage_orange.png', name: '[318] Garbage ถังขยะ / รถขยะ - ส้ม' },
      { emoji: '/blips/radar_garbage_yellow.png', name: '[318] Garbage ถังขยะ / รถขยะ - เหลือง' },
      { emoji: '/blips/radar_garbage.png', name: '[318] Garbage ถังขยะ / รถขยะ - ปกติ' },
    ],
  },
  {
    group: 'ปูน & ก่อสร้าง',
    icons: [
      { emoji: '🧱', name: 'ปูนซีเมนต์ / ตักปูน' },
      { emoji: '🏗️', name: 'ไซต์ก่อสร้าง' },
      { emoji: '⛏️', name: 'พลั่ว / อีเตอร์' },
      { emoji: '🔨', name: 'ค้อนช่าง' },
      { emoji: '🪓', name: 'ขวานตัดไม้' },
      { emoji: '🚜', name: 'รถแทรกเตอร์' },
      { emoji: '🚛', name: 'รถบรรทุกส่งของ' },
    ],
  },
  {
    group: 'แลนด์มาร์ค & มงกุฎ',
    icons: [
      { emoji: '👑', name: 'มงกุฎแลนด์มาร์ค' },
      { emoji: '💎', name: 'เพชร' },
      { emoji: '⭐', name: 'ดาวเด่น' },
      { emoji: '🏆', name: 'ถ้วยรางวัล' },
      { emoji: '🎖️', name: 'เหรียญเกียรติยศ' },
      { emoji: '🏰', name: 'ปราสาท / วัง' },
      { emoji: '🚩', name: 'ธงปักจุด' },
      { emoji: '📍', name: 'หมุดพิกัด' },
    ],
  },
  {
    group: 'เกษตร & สัตว์',
    icons: [
      { emoji: '🌾', name: 'รวงข้าว / นาข้าว' },
      { emoji: '🌷', name: 'ดอกไม้' },
      { emoji: '🌽', name: 'ข้าวโพด' },
      { emoji: '🍇', name: 'องุ่น' },
      { emoji: '🍎', name: 'แอปเปิ้ล' },
      { emoji: '🐖', name: 'ฟาร์มหมู / เนื้อหมู' },
      { emoji: '🥩', name: 'เนื้อสัตว์' },
      { emoji: '🐄', name: 'วัว / นมวัว' },
      { emoji: '🐟', name: 'ตกปลา' },
    ],
  },
  {
    group: 'ไม้ & เหมืองแร่',
    icons: [
      { emoji: '🪵', name: 'ท่อนไม้ / โรงเลื่อย' },
      { emoji: '🌲', name: 'ป่าไม้' },
      { emoji: '🪚', name: 'เลื่อยไม้' },
      { emoji: '🪨', name: 'ก้อนหิน / เหมืองหิน' },
      { emoji: '🪙', name: 'เหรียญแร่ / โทเค็น' },
      { emoji: '🥇', name: 'ทองคำ' },
      { emoji: '⚙️', name: 'โรงงานเหล็ก / อะไหล่' },
      { emoji: '🔩', name: 'น็อต / ตะปู' },
    ],
  },
  {
    group: 'ยานยนต์ & เดินทาง',
    icons: [
      { emoji: '🚗', name: 'โรงรถ / รถยนต์' },
      { emoji: '🏎️', name: 'รถสปอร์ต' },
      { emoji: '🏍️', name: 'แก๊งบิ๊กไบค์ / มอเตอร์ไซค์' },
      { emoji: '🚁', name: 'ลานจอดเฮลิคอปเตอร์' },
      { emoji: '🚤', name: 'ท่าเรือ / เจ็ทสกี' },
      { emoji: '⛽', name: 'ปั๊มน้ำมัน' },
      { emoji: '🔧', name: 'อู่ช่างซ่อมรถ' },
      { emoji: '🏁', name: 'จุดสตาร์ทแข่งรถ' },
      { emoji: '🅿️', name: 'จุดจอดรถยนต์' },
    ],
  },
  {
    group: 'ร้านค้า & บริการ',
    icons: [
      { emoji: '🏪', name: 'ร้านสะดวกซื้อ 24 ชม.' },
      { emoji: '🏬', name: 'ห้างสรรพสินค้า' },
      { emoji: '🍔', name: 'ร้านเบอร์เกอร์' },
      { emoji: '🍕', name: 'ร้านพิซซ่า' },
      { emoji: '☕', name: 'ร้านกาแฟ' },
      { emoji: '🍺', name: 'ผับ / บาร์เหล้า' },
      { emoji: '🍸', name: 'คลับใต้ดิน' },
      { emoji: '💊', name: 'โรงพยาบาล / ร้านยา' },
      { emoji: '💈', name: 'ร้านตัดผม' },
      { emoji: '👕', name: 'ร้านเสื้อผ้า' },
      { emoji: '🎭', name: 'ร้านหน้ากาก' },
      { emoji: '💰', name: 'ถุงเงิน / รับซื้อของ' },
      { emoji: '💵', name: 'ธนาคาร / ตู้ ATM' },
    ],
  },
  {
    group: 'อาวุธ & จุดเสี่ยง',
    icons: [
      { emoji: '⚠️', name: 'จุดอันตราย / ปล้น' },
      { emoji: '💀', name: 'จุดดวล / พื้นที่แดง' },
      { emoji: '🔫', name: 'ร้านขายปืน' },
      { emoji: '💣', name: 'ระเบิด' },
      { emoji: '🗡️', name: 'มีดสั้น' },
      { emoji: '🚨', name: 'สถานีตำรวจ' },
      { emoji: '⚡', name: 'โรงไฟฟ้า' },
      { emoji: '🛑', name: 'จุดตรวจ / ด่าน' },
      { emoji: '🏠', name: 'เซฟเฮ้าส์ / บ้านพัก' },
      { emoji: '🗝️', name: 'Rebel / กล่องลับ' },
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

export const PinModal = ({
  isOpen,
  onClose,
  onSave,
  initialSpot,
  onDelete,
}: PinModalProps) => {
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
  const [coordsPasteInput, setCoordsPasteInput] = useState('');
  const [coordsPasteStatus, setCoordsPasteStatus] = useState<string | null>(null);

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
    if (initialSpot) {
      setName(initialSpot.name || '');
      setIcon(initialSpot.icon || '🧱');
      setColor(initialSpot.color || '#f59e0b');
      setX(initialSpot.x !== undefined ? initialSpot.x : 0);
      setY(initialSpot.y !== undefined ? initialSpot.y : 0);
      setZ(initialSpot.z !== undefined ? initialSpot.z : 30.0);
      setPostal(initialSpot.postal || '');
      setCooldownMinutes(initialSpot.cooldownMinutes ?? 10);
      setYieldDescription(initialSpot.yieldDescription || '');
      setRequiredItemsStr(initialSpot.requiredItems ? initialSpot.requiredItems.join(', ') : '');
      setNotes(initialSpot.notes || '');
    } else {
      setName('');
      setIcon('🧱');
      setColor('#f59e0b');
      setX(0);
      setY(0);
      setZ(30.0);
      setPostal('');
      setCooldownMinutes(10);
      setYieldDescription('');
      setRequiredItemsStr('พลั่วตักทราย, ถุงกระสอบ');
      setNotes('');
    }
  }, [initialSpot, isOpen]);

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

    const updated: CementSpot = {
      id: initialSpot?.id || `spot-${Date.now()}`,
      name: name.trim(),
      category: initialSpot?.category || 'cement_mine',
      icon: icon.trim() || '🧱',
      color,
      x: safeX,
      y: safeY,
      z: safeZ,
      postal: postal.trim(),
      cooldownMinutes: safeCd,
      yieldDescription: yieldDescription.trim(),
      requiredItems: items,
      notes: notes.trim(),
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
              <h2 className="text-base font-bold text-white tracking-wide">
                {initialSpot?.id ? 'แก้ไขหมุดมาร์คเกอร์' : 'สร้างหมุดใหม่บนแผนที่'}
              </h2>
              <p className="text-xs text-slate-400">ตั้งชื่อหมุดและเลือกไอคอนตามต้องการได้อย่างอิสระ</p>
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
          {/* 1. ชื่อจุด / สถานที่ */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
              1. ชื่อจุด / สถานที่ *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น จุดจกปูนลับ, มงกุฎแดง แลนด์มาร์ค, โรงเลื่อยไม้, อู่ซ่อมรถ..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm font-medium"
            />
          </div>

          {/* 2. เลือกไอคอน (Icon Picker) */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>2. เลือกไอคอนหมุด</span>
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
                    placeholder="เช่น 🧱 หรือ 👑"
                    maxLength={4}
                    className="w-16 bg-transparent text-center text-lg font-bold text-white focus:outline-none"
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
                    onClick={() => setIcon(item.emoji)}
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

          {/* 3. เลือกสีหมุด (Marker Color) + Live Preview */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                3. เลือกสีหมุด (Marker Color)
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

          {/* 4. พิกัด X, Y, Z และ Postal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                4. ตำแหน่งพิกัดในเกม FiveM
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

          {/* 5. ข้อมูลเสริม (คูลดาวน์, ผลผลิต, หมายเหตุ) */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>เวลาคูลดาวน์ (นาที)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
                  placeholder="0 หากไม่มีคูลดาวน์"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
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
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400"
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
                className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400"
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
                className="w-full px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {initialSpot?.id && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('คุณต้องการลบหมุดนี้ใช่หรือไม่?')) {
                    onDelete(initialSpot.id!);
                    onClose();
                  }
                }}
                className="px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors border border-red-500/30"
              >
                ลบหมุดนี้
              </button>
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

