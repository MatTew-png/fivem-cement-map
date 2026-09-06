import { useState, useMemo, useEffect } from 'react';
import type { MouseEvent } from 'react';
import {
  Search,
  Plus,
  MapPin,
  Clock,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Crosshair,
  Edit2,
  Trash2,
  Package,
  Flame,
  X,
} from 'lucide-react';
import type { CementSpot, SpotCategory, ActiveCooldown } from '../types/map';
import { CATEGORIES } from '../data/defaultSpots';
import { formatFiveMCommand } from '../utils/storage';

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
}

export const Sidebar = ({
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
}: SidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SpotCategory | 'all' | 'urgent'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openCooldownSpotId, setOpenCooldownSpotId] = useState<string | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('10');

  // Real-time timer tick for countdown displays
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (activeCooldowns.length === 0) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCooldowns.length]);

  // Count spots with urgent cooldown (<= 3 mins)
  const urgentCount = useMemo(() => {
    return spots.filter((spot) => {
      const cd = activeCooldowns.find((c) => c.spotId === spot.id);
      if (!cd) return false;
      const rem = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
      return rem > 0 && rem <= 180;
    }).length;
  }, [spots, activeCooldowns, now]);

  // Filter spots
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
      let matchCat = true;
      if (selectedCategory === 'urgent') {
        const cd = activeCooldowns.find((c) => c.spotId === spot.id);
        const rem = cd ? Math.max(0, Math.floor((cd.expiresAt - now) / 1000)) : -1;
        matchCat = rem > 0 && rem <= 180;
      } else if (selectedCategory !== 'all') {
        matchCat = spot.category === selectedCategory;
      }

      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchCat;

      const matchName = spot.name.toLowerCase().includes(query);
      const matchPostal = spot.postal?.toLowerCase().includes(query);
      const matchNotes = spot.notes?.toLowerCase().includes(query);
      const matchYield = spot.yieldDescription?.toLowerCase().includes(query);

      return matchCat && (matchName || matchPostal || matchNotes || matchYield);
    });
  }, [spots, selectedCategory, searchQuery, activeCooldowns, now]);

  const handleCopyCommand = (e: MouseEvent, spot: CementSpot) => {
    e.stopPropagation();
    const cmd = formatFiveMCommand(spot);
    navigator.clipboard.writeText(cmd);
    setCopiedId(spot.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getActiveCooldown = (spotId: string) => {
    return activeCooldowns.find((c) => c.spotId === spotId);
  };

  return (
    <>
      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-[1050] bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden' : 'w-80 sm:w-96'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
                🧱
              </div>
              <div>
                <h1 className="text-sm font-black text-white tracking-wider flex items-center gap-1.5">
                  <span>FIVEM CEMENT MAP</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                    จกปูน
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">แผนที่มาร์คจุดปูน & พิกัด FiveM</p>
              </div>
            </div>

            {/* Collapse button on mobile/desktop */}
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors md:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onAddNewSpot}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>ปักหมุดใหม่</span>
            </button>

            <button
              onClick={onOpenExportImport}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>แชร์ / ข้อมูล</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อจุด, รหัสไปรษณีย์ เช่น 8042..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg shrink-0 transition-all font-medium ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด ({spots.length})
            </button>

            {urgentCount > 0 && (
              <button
                onClick={() => setSelectedCategory('urgent')}
                className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all animate-bounce ${
                  selectedCategory === 'urgent'
                    ? 'bg-red-600 text-white font-bold shadow-lg shadow-red-600/40'
                    : 'bg-red-950/60 text-red-300 border border-red-500/50 hover:bg-red-900/60'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-yellow-300" />
                <span>ใกล้เกิด ({urgentCount})</span>
              </button>
            )}
            {Object.values(CATEGORIES)
              .filter((cat) => spots.some((s) => s.category === cat.id))
              .map((cat) => {
                const count = spots.filter((s) => s.category === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${
                      isSelected
                        ? `${cat.bgColor} ${cat.borderColor} border text-white font-bold`
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate max-w-[120px]">{cat.name}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
          </div>

          {spots.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-slate-850 border border-slate-700/80 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">🔍 กรองดูทุกประเภท ({spots.length} หมุด)</option>
              {Object.values(CATEGORIES).map((cat) => {
                const count = spots.filter((s) => s.category === cat.id).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name} {count > 0 ? `(${count})` : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Spots List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredSpots.length === 0 ? (
            spots.length === 0 ? (
              <div className="text-center py-16 px-4 text-slate-500 text-xs flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-2xl mb-3 shadow-inner">
                  🗺️
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">ยังไม่มีหมุดบนแผนที่</h4>
                <p className="text-slate-400 mb-4 max-w-[220px] leading-relaxed text-[11px]">
                  ดับเบิ้ลคลิก (Double-click) ที่ใดก็ได้บนแผนที่ หรือกดปุ่มด้านล่างเพื่อเริ่มปักหมุด
                </p>
                <button
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
          ) : (
            filteredSpots.map((spot) => {
              const cat = CATEGORIES[spot.category] || CATEGORIES.cement_mine;
              const isSelected = selectedSpotId === spot.id;
              const activeCooldown = getActiveCooldown(spot.id);
              const spotIcon = spot.icon || cat.icon;
              const spotColor = spot.color || cat.color;

              // Cooldown calculations
              const remainingSec = activeCooldown ? Math.max(0, Math.floor((activeCooldown.expiresAt - now) / 1000)) : 0;
              const isCooldown = !!activeCooldown && remainingSec > 0;
              const isUrgent = isCooldown && remainingSec <= 180; // <= 3 mins
              const isReady = !!activeCooldown && remainingSec === 0;

              const cdMinutes = Math.floor(remainingSec / 60);
              const cdSeconds = remainingSec % 60;
              const cdTimeStr = `${cdMinutes}:${cdSeconds.toString().padStart(2, '0')}`;

              const isCooldownPanelOpen = openCooldownSpotId === spot.id;

              return (
                <div
                  key={spot.id}
                  onClick={() => onSelectSpot(spot)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer group relative text-xs ${
                    isUrgent
                      ? 'bg-red-950/40 border-red-500 shadow-xl shadow-red-500/20 animate-pulse'
                      : isSelected
                      ? 'bg-slate-800/95 border-amber-500/80 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-850/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Urgent / Active Countdown Banner */}
                  {isUrgent ? (
                    <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-[11px] mb-2 shadow-md">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                        <span>ใกล้เกิดแล้ว! ต่ำกว่า 3 นาที</span>
                      </span>
                      <span className="font-mono font-black text-xs">{cdTimeStr}</span>
                    </div>
                  ) : isCooldown ? (
                    <div className="flex items-center justify-between px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] mb-2">
                      <span>⏳ กำลังคูลดาวน์</span>
                      <span className="font-bold">{cdTimeStr}</span>
                    </div>
                  ) : isReady ? (
                    <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] mb-2 shadow-md animate-pulse">
                      <span className="flex items-center gap-1">
                        <span>✅</span>
                        <span>ถึงเวลาเกิดแล้ว! จกได้เลย</span>
                      </span>
                      <button
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

                  {/* Category & Postal badges */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                      style={{
                        backgroundColor: `${spotColor}22`,
                        borderColor: `${spotColor}55`,
                        color: spotColor,
                      }}
                    >
                      <span className="text-xs">{spotIcon}</span>
                      <span>{cat.name}</span>
                    </span>

                    {spot.postal && (
                      <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                        📮 {spot.postal}
                      </span>
                    )}
                  </div>

                  {/* Spot Name */}
                  <h3 className="font-bold text-slate-100 text-sm mb-1 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                    <span className="text-base">{spotIcon}</span>
                    <span>{spot.name}</span>
                  </h3>

                  {/* Yield & required items preview */}
                  {spot.yieldDescription && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-1">
                      <Package className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{spot.yieldDescription}</span>
                    </div>
                  )}

                  {/* Coordinates & Actions */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/70 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Crosshair className="w-3 h-3 text-slate-500" />
                      <span>{spot.x.toFixed(0)}, {spot.y.toFixed(0)}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Copy /tp */}
                      <button
                        onClick={(e) => handleCopyCommand(e, spot)}
                        title="คัดลอกคำสั่ง /tp x y z"
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] flex items-center gap-1 transition-colors border border-slate-700"
                      >
                        {copiedId === spot.id ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            <span>/tp</span>
                          </>
                        )}
                      </button>

                      {/* Cooldown button / toggle quick picker */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCooldownSpotId((prev) => (prev === spot.id ? null : spot.id));
                        }}
                        title={activeCooldown ? 'ปรับเวลาหรือยกเลิกคูลดาวน์' : 'เลือกเวลาคูลดาวน์'}
                        className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-all border ${
                          isUrgent
                            ? 'bg-red-600 text-white border-yellow-300 font-black animate-bounce shadow-md shadow-red-600/50'
                            : activeCooldown
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {isUrgent ? (
                          <Flame className="w-3 h-3 text-yellow-300" />
                        ) : (
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        <span>{isUrgent ? cdTimeStr : isCooldown ? cdTimeStr : `${spot.cooldownMinutes || 10}น.`}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSpot(spot);
                        }}
                        title="แก้ไขข้อมูล"
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`คุณต้องการลบ "${spot.name}" หรือไม่?`)) {
                            onDeleteSpot(spot.id);
                          }
                        }}
                        title="ลบหมุด"
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Quick Cooldown Picker Panel */}
                  {isCooldownPanelOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2.5 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700/90 text-xs space-y-2 shadow-xl animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>เลือกเวลานับถอยหลัง:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenCooldownSpotId(null)}
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
                            onClick={() => {
                              onStartCooldown(spot, m);
                              setOpenCooldownSpotId(null);
                            }}
                            className={`py-1 rounded font-mono font-bold text-[10px] transition-all border ${
                              m <= 3
                                ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500 hover:text-white'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-amber-400 hover:text-slate-950'
                            }`}
                          >
                            {m <= 3 ? '🔥 ' : ''}{m}น.
                          </button>
                        ))}
                      </div>

                      {/* Custom Minutes Input */}
                      <div className="flex items-center gap-1 pt-0.5">
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={customMinutesInput}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setCustomMinutesInput(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const mins = Math.max(1, parseInt(customMinutesInput, 10) || 10);
                              onStartCooldown(spot, mins);
                              setOpenCooldownSpotId(null);
                            }
                          }}
                          placeholder="นาที"
                          className="w-16 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-center font-mono text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-[10px] text-slate-400">นาที</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const mins = Math.max(1, parseInt(customMinutesInput, 10) || 10);
                            onStartCooldown(spot, mins);
                            setOpenCooldownSpotId(null);
                          }}
                          className="ml-auto px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400 transition-colors"
                        >
                          เริ่มนับ
                        </button>
                        {activeCooldown && (
                          <button
                            type="button"
                            onClick={() => {
                              onCancelCooldown(spot.id);
                              setOpenCooldownSpotId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] hover:bg-red-500/30"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[10px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>แสดง {filteredSpots.length} จากทั้งหมด {spots.length} จุด</span>
            {spots.length > 0 && (
              <button
                onClick={onClearAllSpots}
                className="text-red-400/80 hover:text-red-300 transition-colors flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/40"
                title="ลบหมุดทั้งหมดบนแผนที่"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>ล้างหมด</span>
              </button>
            )}
          </div>
          <span className="text-amber-400/80">GTA V / FiveM Thailand</span>
        </div>
      </aside>

      {/* Floating Toggle button when sidebar is collapsed */}
      {isCollapsed && (
        <button
          onClick={onToggleCollapse}
          className="fixed top-4 left-4 z-[1050] p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-amber-400 hover:text-white hover:bg-slate-800 shadow-2xl transition-all"
          title="เปิดแถบจัดการหมุด"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🧱</span>
            <span className="text-xs font-bold text-white pr-1">เปิดเมนู</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      )}
    </>
  );
};
