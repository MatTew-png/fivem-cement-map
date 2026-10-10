import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { soundEffects } from '../utils/sound';
import type { QuickCategory } from '../utils/clustering';

export interface MapQuickFiltersProps {
  categoriesState: Record<QuickCategory, boolean>;
  onToggleCategory: (cat: QuickCategory) => void;
  isClusteringEnabled: boolean;
  onToggleClustering: () => void;
  counts: Record<QuickCategory, number>;
  sidebarCollapsed?: boolean;
}

export const MapQuickFilters = memo(({
  categoriesState,
  onToggleCategory,
  isClusteringEnabled,
  onToggleClustering,
  counts,
  sidebarCollapsed = false,
}: MapQuickFiltersProps) => {
  const handleCategoryClick = (cat: QuickCategory) => {
    soundEffects.playPinPlaced();
    onToggleCategory(cat);
  };

  const handleClusterClick = () => {
    soundEffects.playPinPlaced();
    onToggleClustering();
  };

  return (
    <div
      className={`absolute top-4 z-[1000] max-w-[calc(100vw-180px)] sm:max-w-none pointer-events-none select-none transition-all duration-300 ${
        sidebarCollapsed ? 'left-36 sm:left-40' : 'left-4'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-slate-700/80 shadow-2xl pointer-events-auto overflow-x-auto no-scrollbar">
        {/* 1. Cement Spots */}
        <button
          type="button"
          onClick={() => handleCategoryClick('cement')}
          title={categoriesState.cement ? 'คลิกเพื่อซ่อนจุดปูนบนแมพ' : 'คลิกเพื่อแสดงจุดปูนบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.cement
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>🧱</span>
          <span className="hidden sm:inline">ปูน</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.cement
                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.cement}
          </span>
        </button>

        {/* 2. Race Spots */}
        <button
          type="button"
          onClick={() => handleCategoryClick('race')}
          title={categoriesState.race ? 'คลิกเพื่อซ่อนจุดแข่งรถบนแมพ' : 'คลิกเพื่อแสดงจุดแข่งรถบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.race
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>🏁</span>
          <span className="hidden sm:inline">แข่งรถ</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.race
                ? 'bg-purple-400/20 text-purple-200 border border-purple-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.race}
          </span>
        </button>

        {/* 3. Head Reset (Clinic) */}
        <button
          type="button"
          onClick={() => handleCategoryClick('head_reset')}
          title={categoriesState.head_reset ? 'คลิกเพื่อซ่อนจุดรีหัวบนแมพ' : 'คลิกเพื่อแสดงจุดรีหัวบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.head_reset
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>🏥</span>
          <span className="hidden sm:inline">รีหัว</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.head_reset
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.head_reset}
          </span>
        </button>

        {/* 4. Farm Spots */}
        <button
          type="button"
          onClick={() => handleCategoryClick('farm')}
          title={categoriesState.farm ? 'คลิกเพื่อซ่อนจุดฟาร์มบนแมพ' : 'คลิกเพื่อแสดงจุดฟาร์มบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.farm
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-sm shadow-yellow-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>🌾</span>
          <span className="hidden sm:inline">ฟาร์ม</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.farm
                ? 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.farm}
          </span>
        </button>

        {/* 2. Lands (Royal Kings) */}
        <button
          type="button"
          onClick={() => handleCategoryClick('lands')}
          title={categoriesState.lands ? 'คลิกเพื่อซ่อนจุดแลนบนแมพ' : 'คลิกเพื่อแสดงจุดแลนบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.lands
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm shadow-indigo-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>👑</span>
          <span className="hidden sm:inline">แลน</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.lands
                ? 'bg-indigo-400/20 text-indigo-200 border border-indigo-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.lands}
          </span>
        </button>

        {/* 3. Fuel Stations */}
        <button
          type="button"
          onClick={() => handleCategoryClick('fuel')}
          title={categoriesState.fuel ? 'คลิกเพื่อซ่อนปั๊มน้ำมันบนแมพ' : 'คลิกเพื่อแสดงปั๊มน้ำมันบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.fuel
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>⛽</span>
          <span className="hidden sm:inline">น้ำมัน</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.fuel
                ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.fuel}
          </span>
        </button>

        {/* 4. Services (Hospital, Police, Shops, etc.) */}
        <button
          type="button"
          onClick={() => handleCategoryClick('services')}
          title={categoriesState.services ? 'คลิกเพื่อซ่อนจุดบริการบนแมพ' : 'คลิกเพื่อแสดงจุดบริการบนแมพ'}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
            categoriesState.services
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10'
              : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through opacity-60 hover:opacity-90 hover:text-slate-400'
          }`}
        >
          <span>🏥</span>
          <span className="hidden sm:inline">บริการ</span>
          <span
            className={`font-mono text-[9px] px-1 py-0.2 rounded-full ${
              categoriesState.services
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {counts.services}
          </span>
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-slate-750 mx-0.5 shrink-0" />

        {/* 5. Smart Clustering Toggle */}
        <button
          type="button"
          onClick={handleClusterClick}
          title={
            isClusteringEnabled
              ? 'โหมดรวมกลุ่มหมุดเปิดอยู่ (คลิกเพื่อกระจายหมุดทั้งหมด)'
              : 'โหมดรวมกลุ่มหมุดปิดอยู่ (คลิกเพื่อเปิดระบบรวมกลุ่ม)'
          }
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
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
    </div>
  );
});
