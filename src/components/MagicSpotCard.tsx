import { useState, useEffect, useMemo, useRef, memo } from 'react';
import {
  Clock,
  Crosshair,
  Edit2,
  Trash2,
  Package,
  Flame,
  X,
  Copy,
  Check,
} from 'lucide-react';
import type { CementSpot, ActiveCooldown } from '../types/map';
import { isCementSpot } from '../utils/spotCategories';
import { renderSpotIcon } from '../utils/spotIcons';
import { formatSpotToEuclidObject, copyToClipboard } from '../utils/spotExport';

interface MagicSpotCardProps {
  spot: CementSpot;
  isSelected: boolean;
  activeCooldown?: ActiveCooldown;
  now: number;
  viewMode: 'comfortable' | 'compact';
  openCooldownSpotId: string | null;
  customMinutesInput: string;
  onSelectSpot: (spot: CementSpot) => void;
  onEditSpot: (spot: CementSpot) => void;
  onDeleteSpot: (id: string) => void;
  onStartCooldown: (spot: CementSpot, minutes?: number) => void;
  onCancelCooldown: (spotId: string) => void;
  onToggleCooldownPicker: (spotId: string) => void;
  onChangeCustomMinutes: (val: string) => void;
  onSearchTag: (tag: string) => void;
}

export const MagicSpotCard = memo(({
  spot,
  isSelected,
  activeCooldown,
  now,
  viewMode,
  openCooldownSpotId,
  customMinutesInput,
  onSelectSpot,
  onEditSpot,
  onDeleteSpot,
  onStartCooldown,
  onCancelCooldown,
  onToggleCooldownPicker,
  onChangeCustomMinutes,
  onSearchTag,
}: MagicSpotCardProps) => {
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 });
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const deleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
    };
  }, []);

  // Cooldown status calculation
  const remainingSec = activeCooldown
    ? Math.max(0, Math.floor((activeCooldown.expiresAt - now) / 1000))
    : 0;
  const isCooldown = !!activeCooldown && remainingSec > 0;
  const isUrgent = isCooldown && remainingSec <= 180; // <= 3 minutes
  const isReady = !!activeCooldown && remainingSec === 0;

  const cdMinutes = Math.floor(remainingSec / 60);
  const cdSeconds = remainingSec % 60;
  const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

  const isCooldownPanelOpen = openCooldownSpotId === spot.id;
  const isDrugSpot = spot.category === 'dealer' || spot.name === 'จุดขายยา' || spot.name.includes('ขายยา') || spot.tags?.includes('dealer') || spot.tags?.includes('จุดขายยา');
  const isCement = isCementSpot(spot);
  const isFuel = spot.category === 'fuel' || spot.name.includes('น้ำมัน') || (spot.icon && spot.icon.includes('jerry_can'));

  // Spotlight Mouse tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Smart Contextual Badge
  const badgeInfo = useMemo(() => {
    if (isDrugSpot) {
      return {
        label: 'จุดขายยา (Dealer)',
        icon: '🌿',
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        text: 'text-red-300',
        dot: 'bg-emerald-400',
      };
    }
    if (isCement) {
      return {
        label: 'จุดฟาร์มปูน',
        icon: '🧱',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
      };
    }
    if (isFuel) {
      return {
        label: 'ปั๊มน้ำมัน',
        icon: '⛽',
        bg: 'bg-cyan-500/15',
        border: 'border-cyan-500/40',
        text: 'text-cyan-300',
        dot: 'bg-cyan-400',
      };
    }
    if (spot.name === 'โรงพยาบาล') {
      return {
        label: 'โรงพยาบาล',
        icon: '🏥',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/40',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
      };
    }
    if (spot.name === 'ตำรวจ') {
      return {
        label: 'สถานีตำรวจ',
        icon: '🚔',
        bg: 'bg-blue-500/15',
        border: 'border-blue-500/40',
        text: 'text-blue-300',
        dot: 'bg-blue-400',
      };
    }
    return {
      label: 'แลนด์มาร์ค',
      icon: '👑',
      bg: 'bg-slate-800/60',
      border: 'border-slate-700/60',
      text: 'text-slate-300',
      dot: 'bg-slate-400',
    };
  }, [isDrugSpot, isCement, isFuel, spot.name]);

  // Dynamic Card Aura Color
  const auraColor = isDrugSpot
    ? 'rgba(34, 197, 94, 0.16)'
    : isUrgent
    ? 'rgba(239, 68, 68, 0.22)'
    : isCement
    ? 'rgba(245, 158, 11, 0.15)'
    : isFuel
    ? 'rgba(6, 182, 212, 0.16)'
    : 'rgba(148, 163, 184, 0.12)';

  // ==========================================
  // 1. COMPACT VIEW MODE (Single-line row)
  // ==========================================
  if (viewMode === 'compact') {
    return (
      <div
        onClick={() => onSelectSpot(spot)}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: isHovered
            ? `radial-gradient(220px circle at ${mousePos.x}px ${mousePos.y}px, ${auraColor}, rgba(15, 23, 42, 0.95) 75%)`
            : undefined,
        }}
        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer select-none ${
          isUrgent
            ? 'bg-red-950/40 border-red-500 shadow-lg shadow-red-500/20'
            : isSelected
            ? 'bg-slate-800/90 border-amber-400 ring-1 ring-amber-400/40 shadow-md shadow-amber-500/20'
            : isDrugSpot
            ? 'bg-slate-900/80 border-red-900/40 hover:border-red-500/50'
            : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
        }`}
        title={isSelected ? 'กำลังเลือกหมุดนี้อยู่ (คลิกเพื่อยกเลิกการเลือก)' : 'คลิกเพื่อโฟกัสจุดนี้บนแผนที่'}
      >
        {/* Left: Icon & Name */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center shrink-0 border border-slate-800 shadow-inner">
            {renderSpotIcon(spot.icon || '📍', 'w-3.5 h-3.5')}
          </div>
          <span className="font-bold text-slate-100 truncate group-hover:text-amber-300 transition-colors text-[11px]">
            {spot.name}
          </span>
          {spot.postal && (
            <span className="font-mono text-[9px] text-amber-400/80 shrink-0">
              #{spot.postal}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSpot(spot);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[9px] hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
              title="คลิกเพื่อยกเลิกการเลือก"
            >
              <span>เลือกอยู่</span>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          {/* Quick Cooldown Pill */}
          {isUrgent ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white font-mono font-black text-[9px] shadow">
              <Flame className="w-2.5 h-2.5 text-yellow-300" />
              {cdTimeStr}
            </span>
          ) : isCooldown ? (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {cdTimeStr}
            </span>
          ) : null}


          {/* Quick Cooldown Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCooldownPicker(spot.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800"
            title="ตั้งเวลานับถอยหลัง"
          >
            <Clock className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. COMFORTABLE VIEW MODE (Rich Magic Card)
  // ==========================================
  return (
    <div
      onClick={() => onSelectSpot(spot)}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: isHovered
          ? `radial-gradient(320px circle at ${mousePos.x}px ${mousePos.y}px, ${auraColor}, rgba(15, 23, 42, 0.95) 70%)`
          : undefined,
      }}
      className={`group relative p-3 rounded-2xl border text-xs transition-all cursor-pointer select-none overflow-hidden ${
        isUrgent
          ? 'bg-red-950/40 border-red-500 shadow-xl shadow-red-500/20 animate-pulse'
          : isSelected
          ? 'bg-slate-800/95 border-amber-400 ring-2 ring-amber-400/30 shadow-xl shadow-amber-500/10'
          : isDrugSpot
          ? 'bg-slate-900/90 border-red-900/50 hover:border-emerald-500/50 shadow-md shadow-emerald-500/5'
          : 'bg-slate-900/80 border-slate-800/90 hover:bg-slate-850 hover:border-slate-700 shadow-sm'
      }`}
      title={isSelected ? 'กำลังเลือกหมุดนี้อยู่ (คลิกอีกครั้งเพื่อยกเลิกการเลือก)' : 'คลิกเพื่อโฟกัสจุดนี้บนแผนที่'}
    >
      {/* Magic UI Style Border Beam / Glow on Drug Spots */}
      {isDrugSpot && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 via-transparent to-transparent pointer-events-none rounded-tr-2xl" />
      )}

      {/* Urgent / Active Countdown Banner */}
      {isUrgent ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-[11px] mb-2 shadow-md">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-yellow-300" />
            <span>ใกล้เกิดแล้ว! ต่ำกว่า 3 นาที</span>
          </span>
          <span className="font-mono font-black text-xs">{cdTimeStr}</span>
        </div>
      ) : isCooldown ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] mb-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>กำลังคูลดาวน์</span>
          </span>
          <span className="font-bold text-xs">{cdTimeStr}</span>
        </div>
      ) : isReady ? (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-[11px] mb-2 shadow-md animate-pulse">
          <span className="flex items-center gap-1">
            <span>✅</span>
            <span>ถึงเวลาเกิดแล้ว! จกได้เลย</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelCooldown(spot.id);
            }}
            className="text-[10px] text-emerald-100 hover:text-white underline"
          >
            ปิด
          </button>
        </div>
      ) : null}

      {/* Top Header: Smart Badge & Postal & Selection Indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot} animate-pulse`} />
            <span>{badgeInfo.icon}</span>
            <span>{badgeInfo.label}</span>
          </span>

          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSpot(spot);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm cursor-pointer"
              title="คลิกเพื่อยกเลิกการเลือก (Deselect)"
            >
              <span>กำลังเลือก</span>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {spot.postal && (
          <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-500/30">
            📮 {spot.postal}
          </span>
        )}
      </div>

      {/* Spot Name & Icon */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-black text-slate-100 text-sm group-hover:text-amber-300 transition-colors flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-950/80 flex items-center justify-center border border-slate-800 shadow-sm shrink-0">
            {renderSpotIcon(spot.icon || '📍', 'w-4 h-4')}
          </div>
          <span>{spot.name}</span>
        </h3>

        {/* Note tag preview if exists */}
        {spot.notes && (
          <span className="text-[10px] text-slate-400 font-normal truncate max-w-[120px]" title={spot.notes}>
            {spot.notes}
          </span>
        )}
      </div>

      {/* Yield & required items preview */}
      {spot.yieldDescription && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-1 pl-1">
          <Package className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{spot.yieldDescription}</span>
        </div>
      )}

      {/* Token Field: Tags */}
      {spot.tags && spot.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 my-1.5">
          {spot.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSearchTag(tag);
              }}
              className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 font-mono text-[9px] font-semibold transition-all cursor-pointer"
              title={`คลิกเพื่อกรองเฉพาะหมุดแท็ก ${tag}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Bar: Coordinates & Action Buttons */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-slate-400">
          <Crosshair className="w-3 h-3 text-slate-500" />
          <span>
            {spot.x.toFixed(0)}, {spot.y.toFixed(0)}
          </span>
        </span>

        <div className="flex items-center gap-1">

          {/* Cooldown Button / Picker Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCooldownPicker(spot.id);
            }}
            title={activeCooldown ? 'ปรับเวลาหรือยกเลิกคูลดาวน์' : 'เลือกเวลาคูลดาวน์'}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
              isUrgent
                ? 'bg-red-600 text-white border-yellow-300 font-black shadow-md shadow-red-600/50'
                : activeCooldown
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isUrgent ? (
              <Flame className="w-3 h-3 text-yellow-300" />
            ) : (
              <Clock className="w-3 h-3 text-amber-400" />
            )}
            <span>
              {isUrgent ? cdTimeStr : isCooldown ? cdTimeStr : `${spot.cooldownMinutes || 10}น.`}
            </span>
          </button>

          {/* Copy Spot Button (for epic-euclid) */}
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const json = JSON.stringify(formatSpotToEuclidObject(spot), null, 2);
              await copyToClipboard(json);
              setCopied(true);
              if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
              copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
            }}
            title="คัดลอกข้อมูลหมุด (สำหรับโปรเจกต์ epic-euclid)"
            aria-label="คัดลอกข้อมูลหมุด JSON"
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              copied
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-750'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditSpot(spot);
            }}
            title="แก้ไขข้อมูลหมุด"
            aria-label={`แก้ไข ${spot.name}`}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-750 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button (two-step inline confirmation) */}
          {confirmDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
                setConfirmDelete(false);
                onDeleteSpot(spot.id);
              }}
              title="คลิกอีกครั้งเพื่อยืนยันการลบ"
              className="px-1.5 py-0.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
            >
              ยืนยันลบ?
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
                if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
                deleteTimerRef.current = window.setTimeout(() => setConfirmDelete(false), 3000);
              }}
              title="ลบหมุดนี้"
              aria-label={`ลบ ${spot.name}`}
              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Quick Cooldown Picker */}
      {isCooldownPanelOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2.5 p-2.5 rounded-xl bg-slate-950/95 border border-slate-700 text-xs space-y-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>เลือกเวลานับถอยหลัง:</span>
            </span>
            <button
              type="button"
              onClick={() => onToggleCooldownPicker(spot.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-4 gap-1">
            {[3, 5, 8, 10, 15, 20, 30, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onStartCooldown(spot, m)}
                className={`py-1 rounded-lg font-mono font-bold text-[10px] transition-all border cursor-pointer ${
                  m <= 3
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500 hover:text-white'
                    : 'bg-slate-850 text-slate-300 border-slate-750 hover:bg-amber-400 hover:text-slate-950'
                }`}
              >
                {m <= 3 ? '🔥 ' : ''}
                {m}น.
              </button>
            ))}
          </div>

          {/* Custom Minutes Input */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="number"
              min="1"
              max="180"
              value={customMinutesInput}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChangeCustomMinutes(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const mins = Math.max(1, parseInt(customMinutesInput, 10) || 10);
                  onStartCooldown(spot, mins);
                }
              }}
              placeholder="นาที"
              className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-center font-mono text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <span className="text-[10px] text-slate-400">นาที</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const mins = Math.max(1, parseInt(customMinutesInput, 10) || 10);
                onStartCooldown(spot, mins);
              }}
              className="ml-auto px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400 transition-colors cursor-pointer"
            >
              เริ่มนับ
            </button>
            {activeCooldown && (
              <button
                type="button"
                onClick={() => onCancelCooldown(spot.id)}
                className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] hover:bg-red-500/30 cursor-pointer"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
