import { useState, useMemo, useEffect, memo } from 'react';
import {
  Search,
  Plus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Trash2,
  Lock,
  LayoutGrid,
  Flame,
  LayoutList,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CementSpot, ActiveCooldown } from '../types/map';
import { isCementSpot } from '../data/defaultSpots';
import { MagicSpotCard } from './MagicSpotCard';

interface SidebarProps {
  spots: CementSpot[];
  activeCooldowns: ActiveCooldown[];
  onSelectSpot: (spot: CementSpot) => void;
  onAddNewSpot: () => void;
  onEditSpot: (spot: CementSpot) => void;
  onDeleteSpot: (id: string) => void;
  onStartCooldown: (spot: CementSpot, customMinutes?: number) => void;
  onCancelCooldown: (spotId: string) => void;
  onOpenExportImport: () => void;
  onClearAllSpots: () => void;
  selectedSpotId?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showCementSpots?: boolean;
  onToggleCementSpots?: () => void;
  onlineCount?: number;
  onOpenPresence?: () => void;
  onOpenBento?: () => void;
  memberName?: string;
  isMaster?: boolean;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
}

type FilterTab = 'all' | 'dealers' | 'cement' | 'race' | 'head_reset' | 'farm' | 'fuel' | 'urgent' | 'landmarks';

export const Sidebar = memo(({
  spots,
  activeCooldowns,
  onSelectSpot,
  onAddNewSpot,
  onEditSpot,
  onDeleteSpot,
  onStartCooldown,
  onCancelCooldown,
  onOpenExportImport,
  onClearAllSpots,
  selectedSpotId,
  isCollapsed,
  onToggleCollapse,
  showCementSpots = false,
  onToggleCementSpots,
  onlineCount,
  onOpenPresence,
  onOpenBento,
  memberName,
  isMaster = false,
  isSoundMuted = false,
  onToggleSound,
}: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable');
  const [openCooldownSpotId, setOpenCooldownSpotId] = useState<string | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('10');

  // Accordion open/collapse state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    cooldowns: true,
    dealers: true,
    race: true,
    head_reset: true,
    farm: true,
    fuel: true,
    cement: false, // Collapsed by default (87 spots) so screen isn't overwhelmed
    landmarks: false,
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Real-time timer tick for countdown displays
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (activeCooldowns.length === 0) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCooldowns.length]);

  // Keyboard shortcut: Press '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const input = document.getElementById('sidebar-search-input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Spot classifier helpers
  const isDealer = (s: CementSpot): boolean =>
    s.category === 'dealer' ||
    s.name === 'จุดขายยา' ||
    s.name.includes('ขายยา') ||
    Boolean(s.icon?.includes('pickup_weed')) ||
    Boolean(s.tags?.includes('dealer')) ||
    Boolean(s.tags?.includes('จุดขายยา'));
  const isCement = (s: CementSpot): boolean => isCementSpot(s);
  const isRace = (s: CementSpot): boolean =>
    s.category === 'race' ||
    s.name.includes('แข่งรถ') ||
    Boolean(s.icon?.includes('race_land')) ||
    Boolean(s.tags?.includes('race')) ||
    Boolean(s.tags?.includes('แข่งรถ'));
  const isHeadReset = (s: CementSpot): boolean =>
    s.category === 'head_reset' ||
    s.name.includes('รีหัว') ||
    Boolean(s.icon && s.icon.includes('radar_bar') && !s.icon.includes('biker_bar')) ||
    Boolean(s.tags?.includes('head_reset')) ||
    Boolean(s.tags?.includes('รีหัว'));
  const isFarm = (s: CementSpot): boolean =>
    !isHeadReset(s) && (
      s.category === 'farm' ||
      s.name.includes('ฟาร์ม') ||
      s.name.includes('ฟาม') ||
      Boolean(s.icon && s.icon.includes('contraband')) ||
      s.icon === '🌾' ||
      Boolean(s.tags?.includes('farm')) ||
      Boolean(s.tags?.includes('ฟาร์ม'))
    );
  const isFuel = (s: CementSpot): boolean =>
    s.category === 'fuel' ||
    Boolean(s.name.includes('น้ำมัน') || (s.icon && s.icon.includes('jerry_can')));

  // Count spots with urgent cooldown (<= 3 mins)
  const urgentCount = useMemo(() => {
    return spots.filter((spot) => {
      const cd = activeCooldowns.find((c) => c.spotId === spot.id);
      if (!cd) return false;
      const rem = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
      return rem > 0 && rem <= 180;
    }).length;
  }, [spots, activeCooldowns, now]);

  // Overall counts for dock tabs
  const counts = useMemo(() => {
    let dealersCount = 0;
    let cementCount = 0;
    let raceCount = 0;
    let headResetCount = 0;
    let farmCount = 0;
    let fuelCount = 0;
    let landmarksCount = 0;

    spots.forEach((s) => {
      if (isDealer(s)) dealersCount++;
      else if (isCement(s)) cementCount++;
      else if (isRace(s)) raceCount++;
      else if (isHeadReset(s)) headResetCount++;
      else if (isFarm(s)) farmCount++;
      else if (isFuel(s)) fuelCount++;
      else landmarksCount++;
    });

    return {
      total: spots.length,
      dealers: dealersCount,
      cement: cementCount,
      race: raceCount,
      head_reset: headResetCount,
      farm: farmCount,
      fuel: fuelCount,
      landmarks: landmarksCount,
    };
  }, [spots]);

  // Filter spots based on tab and search
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
      // 1. Tab filter
      let matchTab = true;
      if (selectedFilter === 'dealers') {
        matchTab = isDealer(spot);
      } else if (selectedFilter === 'cement') {
        matchTab = isCement(spot);
      } else if (selectedFilter === 'race') {
        matchTab = isRace(spot);
      } else if (selectedFilter === 'head_reset') {
        matchTab = isHeadReset(spot);
      } else if (selectedFilter === 'farm') {
        matchTab = isFarm(spot);
      } else if (selectedFilter === 'fuel') {
        matchTab = isFuel(spot);
      } else if (selectedFilter === 'urgent') {
        const cd = activeCooldowns.find((c) => c.spotId === spot.id);
        const rem = cd ? Math.max(0, Math.floor((cd.expiresAt - now) / 1000)) : -1;
        matchTab = rem > 0 && rem <= 180;
      } else if (selectedFilter === 'landmarks') {
        matchTab = !isDealer(spot) && !isCement(spot) && !isRace(spot) && !isHeadReset(spot) && !isFarm(spot) && !isFuel(spot);
      }

      // 2. Search query filter
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchTab;

      const matchName = spot.name.toLowerCase().includes(query);
      const matchPostal = spot.postal?.toLowerCase().includes(query);
      const matchNotes = spot.notes?.toLowerCase().includes(query);
      const matchYield = spot.yieldDescription?.toLowerCase().includes(query);
      const matchTags = spot.tags?.some((t) => t.toLowerCase().includes(query));

      return matchTab && (matchName || matchPostal || matchNotes || matchYield || matchTags);
    }).sort((a, b) => {
      if (selectedFilter === 'urgent') {
        const cdA = activeCooldowns.find((c) => c.spotId === a.id);
        const cdB = activeCooldowns.find((c) => c.spotId === b.id);
        const expA = cdA ? cdA.expiresAt : Infinity;
        const expB = cdB ? cdB.expiresAt : Infinity;
        return expA - expB;
      }
      return 0;
    });
  }, [spots, selectedFilter, searchQuery, activeCooldowns, now]);

  // Group filtered spots into Smart Categories for the Accordion view
  const groupedSpots = useMemo(() => {
    const dealers: CementSpot[] = [];
    const cement: CementSpot[] = [];
    const race: CementSpot[] = [];
    const headReset: CementSpot[] = [];
    const farm: CementSpot[] = [];
    const fuel: CementSpot[] = [];
    const landmarks: CementSpot[] = [];
    const cooldownList: CementSpot[] = [];

    filteredSpots.forEach((spot) => {
      // Active cooldowns
      const cd = activeCooldowns.find((c) => c.spotId === spot.id);
      if (cd && cd.expiresAt > now) {
        cooldownList.push(spot);
      }

      if (isDealer(spot)) {
        dealers.push(spot);
      } else if (isCement(spot)) {
        cement.push(spot);
      } else if (isRace(spot)) {
        race.push(spot);
      } else if (isHeadReset(spot)) {
        headReset.push(spot);
      } else if (isFarm(spot)) {
        farm.push(spot);
      } else if (isFuel(spot)) {
        fuel.push(spot);
      } else {
        landmarks.push(spot);
      }
    });

    return {
      dealers,
      cement,
      race,
      headReset,
      farm,
      fuel,
      landmarks,
      cooldownList,
    };
  }, [filteredSpots, activeCooldowns, now]);

  const isSearching = searchQuery.trim().length > 0;

  // Render Card Helper
  const renderCard = (spot: CementSpot) => {
    const activeCooldown = activeCooldowns.find((c) => c.spotId === spot.id);
    return (
      <MagicSpotCard
        key={spot.id}
        spot={spot}
        isSelected={selectedSpotId === spot.id}
        activeCooldown={activeCooldown}
        now={now}
        viewMode={viewMode}
        openCooldownSpotId={openCooldownSpotId}
        customMinutesInput={customMinutesInput}
        onSelectSpot={onSelectSpot}
        onEditSpot={onEditSpot}
        onDeleteSpot={onDeleteSpot}
        onStartCooldown={(s, m) => {
          onStartCooldown(s, m);
          setOpenCooldownSpotId(null);
        }}
        onCancelCooldown={(id) => {
          onCancelCooldown(id);
          setOpenCooldownSpotId(null);
        }}
        onToggleCooldownPicker={(id) => {
          setOpenCooldownSpotId((prev) => (prev === id ? null : id));
        }}
        onChangeCustomMinutes={setCustomMinutesInput}
        onSearchTag={(tag) => setSearchQuery(tag)}
      />
    );
  };

  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-[1050] bg-slate-900/95 backdrop-blur-2xl border-r border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden' : 'w-80 sm:w-96'
        }`}
      >
        {/* ======================================================== */}
        {/* 1. COMPACT TACTICAL HEADER                               */}
        {/* ======================================================== */}
        <div className="p-3.5 border-b border-slate-800/90 bg-slate-950/80 flex flex-col gap-2.5">
          {/* Brand & Presence Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-amber-500/20">
                🧱
              </div>
              <div>
                <h1 className="text-xs font-black text-white tracking-wider flex items-center gap-1.5">
                  <span>รันทุกเวิบ COOLDOWN</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 py-0.2 rounded border border-amber-500/30">
                    จุดปูน
                  </span>
                </h1>
                {onOpenPresence && (
                  <button
                    type="button"
                    onClick={onOpenPresence}
                    className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer group mt-0.5"
                    title="คลิกเพื่อดูสมาชิกแก๊งออนไลน์"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>ออนไลน์ {onlineCount ?? 1} คน</span>
                    {memberName && <span className="text-slate-500 font-normal">({memberName})</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Header Right Actions: Sound Mute Toggle & Collapse Menu Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleSound && (
                <button
                  type="button"
                  onClick={onToggleSound}
                  className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSoundMuted
                      ? 'bg-red-500/20 text-red-300 border-red-500/60 shadow-sm shadow-red-500/20 hover:bg-red-500/30'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                  title={isSoundMuted ? 'เปิดเสียงเอฟเฟกต์ (ขณะนี้ปิดเสียงโหมดสตรีม)' : 'ปิดเสียงเอฟเฟกต์ (โหมดสตรีม)'}
                >
                  {isSoundMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
                </button>
              )}

              {/* Collapse toggle button (Accessible on all devices - desktop & mobile) */}
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700/80 hover:border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm group active:scale-95"
                title="ย่อแถบเมนู (ซ่อนแถบเมนูเพื่อดูแผนที่เต็มจอ)"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-amber-400" />
                <span className="text-[11px]">ย่อเมนู</span>
              </button>
            </div>
          </div>

          {/* Action Row: Magic Shimmer Button + Export + Bento */}
          <div className="grid grid-cols-12 gap-1.5 items-center">
            {/* Shimmer Button: Add New Pin */}
            <button
              type="button"
              onClick={onAddNewSpot}
              className="col-span-5 relative group overflow-hidden rounded-xl p-[1.2px] font-bold text-xs shadow-md shadow-amber-500/10 active:scale-95 transition-all cursor-pointer"
            >
              <span className="absolute inset-[-1000%] animate-[spin_3.5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#f59e0b_0%,#fef08a_50%,#f59e0b_100%)] opacity-85 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-[10.8px] bg-slate-950/90 group-hover:bg-slate-900 text-amber-300 font-bold text-xs transition-colors backdrop-blur-md">
                <Plus className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-90 transition-transform duration-300" />
                <span>ปักหมุด</span>
              </span>
            </button>

            {/* Export / Import Button */}
            <button
              type="button"
              onClick={onOpenExportImport}
              className={`col-span-4 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                isMaster
                  ? 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700/80 shadow-sm'
                  : 'bg-slate-900/60 hover:bg-slate-850 text-slate-400 border-slate-800'
              }`}
              title={isMaster ? 'ส่งออก / นำเข้าพิกัด' : 'การส่งออกพิกัดถูกจำกัดสิทธิ์เฉพาะหัวหน้าแก๊ง'}
            >
              {isMaster ? <Download className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-500/70" />}
              <span>{isMaster ? 'ส่งออก' : 'นำเข้า'}</span>
            </button>

            {/* Bento Trigger Button */}
            {onOpenBento && (
              <button
                type="button"
                onClick={onOpenBento}
                className="col-span-3 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-amber-400 font-bold text-xs transition-all shadow-sm cursor-pointer group"
                title="เปิด Tactical Intel Bento Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span>Bento</span>
              </button>
            )}
          </div>

          {/* Search Bar + View Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="sidebar-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อจุด..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-850 border border-slate-750 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 focus:outline-none transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5"
                >
                  ✕
                </button>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 border border-slate-700 rounded px-1 pointer-events-none">
                  /
                </span>
              )}
            </div>

            {/* View Mode Switcher: Comfortable vs Compact */}
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'))}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-750'
              }`}
              title={viewMode === 'comfortable' ? 'สลับเป็นโหมดกระชับ (กะทัดรัด)' : 'สลับเป็นโหมดการ์ดละเอียด'}
            >
              {viewMode === 'comfortable' ? (
                <LayoutList className="w-4 h-4" />
              ) : (
                <SlidersHorizontal className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* ======================================================== */}
          {/* 2. MAGIC SEGMENTED FILTER DOCK                           */}
          {/* ======================================================== */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
            {/* All */}
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold transition-all cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-850 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750'
              }`}
            >
              ✨ ทั้งหมด ({counts.total})
            </button>

            {/* Dealers / Drug Selling (Show only if any exist) */}
            {counts.dealers > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFilter('dealers')}
                className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  selectedFilter === 'dealers'
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-red-950/40 text-red-300 border border-red-500/30 hover:bg-red-900/40'
                }`}
              >
                <span>🌿</span>
                <span>ขายยา ({counts.dealers})</span>
              </button>
            )}

            {/* Cement Mines */}
            <button
              type="button"
              onClick={() => setSelectedFilter('cement')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'cement'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-850 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
              }`}
            >
              <span>🧱</span>
              <span>ปูน ({counts.cement})</span>
              {onToggleCementSpots && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCementSpots();
                  }}
                  title={showCementSpots ? 'กำลังแสดงบนแมพ (คลิกเพื่อซ่อน)' : 'ซ่อนอยู่บนแมพ (คลิกเพื่อแสดง)'}
                  className={`ml-0.5 px-1 py-0.1 rounded text-[8px] font-mono ${
                    showCementSpots ? 'bg-amber-400/30 text-amber-100' : 'bg-slate-750 text-slate-400'
                  }`}
                >
                  {showCementSpots ? '✓' : '✕'}
                </span>
              )}
            </button>

            {/* Race */}
            <button
              type="button"
              onClick={() => setSelectedFilter('race')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'race'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/40'
              }`}
            >
              <span>🏁</span>
              <span>แข่งรถ ({counts.race})</span>
            </button>

            {/* Head Reset (93 radar_bar) */}
            <button
              type="button"
              onClick={() => setSelectedFilter('head_reset')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'head_reset'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'bg-pink-950/40 text-pink-300 border border-pink-500/30 hover:bg-pink-900/40'
              }`}
            >
              <img src="/blips/radar_bar_pink.png" alt="" className="w-3.5 h-3.5 object-contain inline-block pointer-events-none" />
              <span>รีหัว ({counts.head_reset})</span>
            </button>

            {/* Farm (478 radar_contraband) */}
            <button
              type="button"
              onClick={() => setSelectedFilter('farm')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'farm'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40'
              }`}
            >
              <img src="/blips/radar_contraband.png" alt="" className="w-3.5 h-3.5 object-contain inline-block pointer-events-none" />
              <span>ฟาร์ม ({counts.farm})</span>
            </button>

            {/* Fuel */}
            <button
              type="button"
              onClick={() => setSelectedFilter('fuel')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'fuel'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/40'
              }`}
            >
              <span>⛽</span>
              <span>น้ำมัน ({counts.fuel})</span>
            </button>

            {/* Urgent / Cooldowns */}
            {urgentCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFilter('urgent')}
                className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer animate-bounce ${
                  selectedFilter === 'urgent'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/40'
                    : 'bg-red-950/60 text-red-300 border border-red-500/60 hover:bg-red-900/60'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-yellow-300" />
                <span>ใกล้เกิด ({urgentCount})</span>
              </button>
            )}

            {/* Landmarks & Services */}
            <button
              type="button"
              onClick={() => setSelectedFilter('landmarks')}
              className={`px-2 py-1 rounded-xl shrink-0 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                selectedFilter === 'landmarks'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'bg-slate-850 text-slate-300 border border-slate-750 hover:bg-slate-800'
              }`}
            >
              <span>👑</span>
              <span>บริการ ({counts.landmarks})</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. SCROLLABLE SPOT LIST & ACCORDION GROUPS               */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredSpots.length === 0 ? (
            spots.length === 0 ? (
              <div className="text-center py-16 px-4 text-slate-500 text-xs flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  🗺️
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">ยังไม่มีหมุดบนแผนที่</h4>
                <p className="text-slate-400 mb-4 max-w-[220px] leading-relaxed text-[11px]">
                  ดับเบิ้ลคลิกบนแผนที่ หรือกดปุ่มด้านบนเพื่อเริ่มปักหมุด
                </p>
                <button
                  type="button"
                  onClick={onAddNewSpot}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>ปักหมุดจุดแรก</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p>ไม่พบจุดที่ตรงกับเงื่อนไขการค้นหา</p>
              </div>
            )
          ) : selectedFilter === 'all' ? (
            /* ==================================================== */
            /* ACCORDION MODE (Categorized Collapsible Sections)     */
            /* ==================================================== */
            <div className="space-y-2.5">
              {/* 1. Active Cooldowns (if any) */}
              {groupedSpots.cooldownList.length > 0 && (
                <div className="rounded-2xl border border-amber-500/40 bg-slate-950/50 overflow-hidden shadow-lg shadow-amber-500/5 transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('cooldowns')}
                    className="w-full flex items-center justify-between p-2.5 bg-amber-500/10 hover:bg-amber-500/15 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        ⏰
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-amber-300">กำลังคูลดาวน์</span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {groupedSpots.cooldownList.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">จุดที่กำลังนับถอยหลังเกิดใหม่</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.cooldowns ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.cooldowns) && (
                    <div className="p-2 space-y-2 border-t border-amber-500/20 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.cooldownList.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Drug Selling Spots (Dealers) */}
              {groupedSpots.dealers.length > 0 && (
                <div className="rounded-2xl border border-red-900/50 bg-slate-950/50 overflow-hidden shadow-md transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('dealers')}
                    className="w-full flex items-center justify-between p-2.5 bg-red-950/20 hover:bg-red-950/30 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        🌿
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-red-200 group-hover:text-red-100">
                            จุดขายยา (Dealer)
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-red-500/20 text-red-300 border border-red-500/40">
                            {groupedSpots.dealers.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">พิกัดส่งของเถื่อนทั่วเมือง Los Santos</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-red-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.dealers ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.dealers) && (
                    <div className="p-2 space-y-2 border-t border-red-900/30 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.dealers.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Racing Spots */}
              {groupedSpots.race.length > 0 && (
                <div className="rounded-2xl border border-purple-900/40 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('race')}
                    className="w-full flex items-center justify-between p-2.5 bg-purple-950/20 hover:bg-purple-950/30 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        🏁
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-purple-200 group-hover:text-purple-100">
                            แข่งรถ (Racing)
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {groupedSpots.race.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">สนามแข่งและจุดแข่งรถ</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-purple-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.race ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.race) && (
                    <div className="p-2 space-y-2 border-t border-purple-900/30 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.race.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Head Reset / Bar */}
              {groupedSpots.headReset.length > 0 && (
                <div className="rounded-2xl border border-pink-900/40 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('head_reset')}
                    className="w-full flex items-center justify-between p-2.5 bg-pink-950/20 hover:bg-pink-950/30 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        <img src="/blips/radar_bar_pink.png" alt="" className="w-4 h-4 object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-pink-200 group-hover:text-pink-100">
                            รีหัว (Head Reset)
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-pink-500/20 text-pink-300 border border-pink-500/40">
                            {groupedSpots.headReset.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">จุดรีหัวและบาร์เหล้า (Blip 93)</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-pink-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.head_reset ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.head_reset) && (
                    <div className="p-2 space-y-2 border-t border-pink-900/30 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.headReset.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Farm Spots (Contraband) */}
              {groupedSpots.farm.length > 0 && (
                <div className="rounded-2xl border border-amber-900/40 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('farm')}
                    className="w-full flex items-center justify-between p-2.5 bg-amber-950/20 hover:bg-amber-950/30 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        <img src="/blips/radar_contraband.png" alt="" className="w-4 h-4 object-contain" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-amber-200 group-hover:text-amber-100">
                            ฟาร์ม (Farm)
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {groupedSpots.farm.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">จุดฟาร์มและของเถื่อน (Blip 478)</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.farm ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.farm) && (
                    <div className="p-2 space-y-2 border-t border-amber-900/30 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.farm.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 6. Fuel Stations */}
              {groupedSpots.fuel.length > 0 && (
                <div className="rounded-2xl border border-cyan-900/40 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('fuel')}
                    className="w-full flex items-center justify-between p-2.5 bg-cyan-950/20 hover:bg-cyan-950/30 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        ⛽
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-cyan-200 group-hover:text-cyan-100">
                            สถานีน้ำมัน
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {groupedSpots.fuel.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">จุดเติมน้ำมันและแกลลอน</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.fuel ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.fuel) && (
                    <div className="p-2 space-y-2 border-t border-cyan-900/30 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.fuel.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Cement Gathering Mines */}
              {groupedSpots.cement.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('cement')}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-850 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        🧱
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-amber-200 group-hover:text-amber-100">
                            จุดฟาร์มปูน
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {groupedSpots.cement.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {expandedGroups.cement || isSearching
                            ? 'เหมืองจกปูนรอบแมพ'
                            : 'คลิกเพื่อเปิดดู 87 จุดฟาร์ม'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.cement ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.cement) && (
                    <div className="p-2 space-y-2 border-t border-slate-800 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.cement.map(renderCard)}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Landmarks & Other Services */}
              {groupedSpots.landmarks.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => toggleGroup('landmarks')}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-850 text-left transition-colors cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-transform">
                        👑
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-200 group-hover:text-white">
                            สถานที่สำคัญ & บริการ
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full font-mono font-bold text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                            {groupedSpots.landmarks.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {expandedGroups.landmarks || isSearching
                            ? 'ตำรวจ โรงพยาบาล ร้านค้า อู่รถ'
                            : 'คลิกเพื่อเปิดดู 25 จุดบริการ'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isSearching || expandedGroups.landmarks ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {(isSearching || expandedGroups.landmarks) && (
                    <div className="p-2 space-y-2 border-t border-slate-800 bg-slate-900/30 animate-in fade-in duration-150">
                      {groupedSpots.landmarks.map(renderCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ==================================================== */
            /* SINGLE CATEGORY FILTERED LIST                        */
            /* ==================================================== */
            <div className="space-y-2">
              {filteredSpots.map(renderCard)}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 4. COMPACT FOOTER                                        */}
        {/* ======================================================== */}
        <div className="p-2.5 border-t border-slate-800/90 bg-slate-950/90 text-[10px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>
              แสดง {filteredSpots.length} จาก {spots.length} จุด
            </span>
            {spots.length > 0 && (
              <button
                type="button"
                onClick={onClearAllSpots}
                className="text-red-400/80 hover:text-red-300 transition-colors flex items-center gap-0.5 ml-1 px-1.5 py-0.2 rounded bg-red-950/40 border border-red-800/40 cursor-pointer"
                title="ลบหมุดทั้งหมดบนแผนที่"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>ล้างหมด</span>
              </button>
            )}
          </div>
          <span className="text-amber-400/80 font-mono">FiveM RunThukVerb</span>
        </div>

        {/* Edge Handle Tab on right border to quickly collapse */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-[1060] w-3.5 h-16 rounded-r-xl bg-slate-900/95 border border-l-0 border-slate-700/90 text-slate-400 hover:text-amber-300 hover:w-5 items-center justify-center shadow-xl transition-all cursor-pointer group"
            title="คลิกเพื่อย่อแถบเมนูซ่อนไปทางซ้าย"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
      </aside>

      {/* Floating Reopen Button when sidebar is collapsed */}
      {isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="fixed top-4 left-4 z-[1050] px-3.5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/90 text-amber-400 hover:text-white hover:bg-slate-800 shadow-2xl transition-all cursor-pointer flex items-center gap-2 group hover:scale-105 active:scale-95"
          title="เปิดแถบจัดการหมุดและเมนู (ขยายเมนู)"
        >
          <span className="text-base">🧱</span>
          <span className="text-xs font-bold text-white pr-0.5">เปิดเมนู</span>
          <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </>
  );
});
