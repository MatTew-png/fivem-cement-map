import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, SlidersHorizontal, ChevronDown, Check, Layers } from 'lucide-react';
import { soundEffects } from '../utils/sound';
import {
  INITIAL_QUICK_CATEGORIES_STATE,
  QUICK_CATEGORY_OPTIONS,
  type QuickCategory,
} from '../utils/spotCategories';

export interface MapQuickFiltersProps {
  categoriesState: Record<QuickCategory, boolean>;
  onToggleCategory: (cat: QuickCategory) => void;
  onSetCategoriesState?: (state: Record<QuickCategory, boolean>) => void;
  isClusteringEnabled: boolean;
  onToggleClustering: () => void;
  counts: Record<QuickCategory, number>;
  sidebarCollapsed?: boolean;
}

const FOCUS_CATEGORY_IDS = new Set<QuickCategory>(['head_reset', 'farm', 'lands']);

function buildAllCategoriesState(value: boolean): Record<QuickCategory, boolean> {
  return QUICK_CATEGORY_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.id] = value;
      return acc;
    },
    { ...INITIAL_QUICK_CATEGORIES_STATE }
  );
}

export const MapQuickFilters = memo(({
  categoriesState,
  onToggleCategory,
  onSetCategoriesState,
  isClusteringEnabled,
  onToggleClustering,
  counts,
  sidebarCollapsed = false,
}: MapQuickFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const totalCount = QUICK_CATEGORY_OPTIONS.length;

  const activeCount = useMemo(() => {
    return QUICK_CATEGORY_OPTIONS.filter((opt) => Boolean(categoriesState[opt.id])).length;
  }, [categoriesState]);

  const isOnlyResetFarmLands = useMemo(() => {
    return QUICK_CATEGORY_OPTIONS.every((opt) =>
      FOCUS_CATEGORY_IDS.has(opt.id) ? Boolean(categoriesState[opt.id]) : !categoriesState[opt.id]
    );
  }, [categoriesState]);

  const handleCategoryClick = (cat: QuickCategory) => {
    soundEffects.playPinPlaced();
    onToggleCategory(cat);
  };

  const handleClusterClick = () => {
    soundEffects.playPinPlaced();
    onToggleClustering();
  };

  const handleSelectAll = () => {
    if (!onSetCategoriesState) return;
    soundEffects.playPinPlaced();
    onSetCategoriesState(buildAllCategoriesState(true));
  };

  const handleDeselectAll = () => {
    if (!onSetCategoriesState) return;
    soundEffects.playPinPlaced();
    onSetCategoriesState(buildAllCategoriesState(false));
  };

  const handleToggleFocusPreset = () => {
    if (!onSetCategoriesState) return;
    soundEffects.playPinPlaced();
    if (isOnlyResetFarmLands) {
      onSetCategoriesState(buildAllCategoriesState(true));
    } else {
      const next = buildAllCategoriesState(false);
      FOCUS_CATEGORY_IDS.forEach((id) => {
        next[id] = true;
      });
      onSetCategoriesState(next);
    }
  };

  return (
    <div
      className={`absolute top-4 z-[1000] select-none transition-all duration-300 ${
        sidebarCollapsed ? 'left-36 sm:left-40' : 'left-4'
      }`}
    >
      <div className="relative pointer-events-auto" ref={dropdownRef}>
        {/* Compact Floating Bar */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-slate-700/80 shadow-2xl">
          {/* Quick Preset: Focus รีหัว/ฟาร์ม/แลน */}
          {onSetCategoriesState && (
            <button
              type="button"
              onClick={handleToggleFocusPreset}
              title="สลับแสดงเฉพาะ: รีหัว, ฟาร์ม, แลน (สำหรับทำงาน/ฟาร์ม)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
                isOnlyResetFarmLands
                  ? 'bg-gradient-to-r from-pink-500/30 via-amber-500/30 to-indigo-500/30 text-amber-200 border-amber-400 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
              }`}
            >
              <span>🎯</span>
              <span className="hidden sm:inline">รีหัว/ฟาร์ม/แลน</span>
              <span className="sm:hidden">3 หมวด</span>
            </button>
          )}

          {/* Separator */}
          {onSetCategoriesState && <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0" />}

          {/* Dropdown Trigger Button */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playPinPlaced();
              setIsOpen((prev) => !prev);
            }}
            title="คลิกเพื่อเปิดเมนูเลือกตัวกรองหมวดหมู่บนแผนที่"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
              isOpen
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-sm shadow-amber-500/20'
                : activeCount < totalCount
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>ตัวกรองหมวดหมู่</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
                activeCount === totalCount
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : activeCount === 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {activeCount}/{totalCount}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>

          {/* Separator */}
          <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0" />

          {/* Smart Clustering Toggle */}
          <button
            type="button"
            onClick={handleClusterClick}
            title={
              isClusteringEnabled
                ? 'โหมดรวมกลุ่มหมุดเปิดอยู่ (คลิกเพื่อกระจายหมุดทั้งหมด)'
                : 'โหมดรวมกลุ่มหมุดปิดอยู่ (คลิกเพื่อเปิดระบบรวมกลุ่ม)'
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
              isClusteringEnabled
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 transition-colors ${
                isClusteringEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span className="hidden sm:inline">รวมกลุ่ม</span>
            <span
              className={`text-[9px] font-mono px-1 py-0.2 rounded font-black ${
                isClusteringEnabled ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {isClusteringEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Dropdown Menu Popover */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-3 z-[1100] animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>ตัวกรองหมวดหมู่บนแมพ</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                เปิดอยู่ {activeCount}/{totalCount}
              </span>
            </div>

            {/* Quick Actions */}
            {onSetCategoriesState && (
              <div className="flex items-center gap-1.5 mb-2.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer text-center"
                >
                  ✓ เปิดทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] font-bold text-slate-400 hover:text-red-300 transition-colors cursor-pointer text-center"
                >
                  ✕ ปิดทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleToggleFocusPreset}
                  className="py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 transition-colors cursor-pointer text-center"
                  title="เปิดเฉพาะ: รีหัว, ฟาร์ม, แลน"
                >
                  🎯 3 หมวด
                </button>
              </div>
            )}

            {/* Category Items List */}
            <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
              {QUICK_CATEGORY_OPTIONS.map((cat) => {
                const isActive = Boolean(categoriesState[cat.id]);
                const count = counts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-slate-800/80 border-slate-700/80 text-white hover:bg-slate-800 hover:border-slate-600'
                        : 'bg-slate-900/40 border-transparent text-slate-500 hover:text-slate-400 hover:bg-slate-800/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                          isActive
                            ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                            : 'border-slate-700 bg-slate-800 text-transparent'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <img
                          src={cat.icon}
                          alt=""
                          className="w-4 h-4 object-contain inline-block pointer-events-none"
                        />
                        <span className={`font-semibold text-xs ${isActive ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                          {cat.label}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                        isActive
                          ? `${cat.activeBg} ${cat.borderColor}`
                          : 'bg-slate-800/80 border-slate-700/60 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
