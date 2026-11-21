import { useState, useEffect, useRef, memo } from 'react';
import { Crosshair, Copy, Check, Layers, Target, Lock, Unlock, Compass, SlidersHorizontal } from 'lucide-react';
import { coordsBus } from '../utils/coordsBus';
import type { CementSpot } from '../types/map';

interface CoordinatesHUDProps {
  cursorCoords?: { x: number; y: number } | null;
  lockedCoords?: { x: number; y: number } | null;
  zoom: number;
  activeLayerName: string;
  showCrosshair: boolean;
  onToggleCrosshair: () => void;
  onPinAtCrosshair?: () => void;
  isCompactMode?: boolean;
  onToggleCompactMode?: () => void;
  isGhostMode?: boolean;
  onToggleGhostMode?: () => void;
  isCoordsLocked?: boolean;
  onToggleLockCoords?: () => void;
  onPinAtLocked?: () => void;
  showCementSpots?: boolean;
  onToggleCementSpots?: () => void;
  cementCount?: number;
  selectedSpot?: CementSpot | null;
  movingSpot?: CementSpot | null;
  onStartMoveSpot?: (spot: CementSpot) => void;
}

export const CoordinatesHUD = memo(({
  cursorCoords: propCoords,
  lockedCoords,
  zoom,
  activeLayerName,
  showCrosshair,
  onToggleCrosshair,
  onPinAtCrosshair,
  isCompactMode,
  onToggleCompactMode,
  isGhostMode,
  onToggleGhostMode,
  isCoordsLocked = false,
  onToggleLockCoords,
  onPinAtLocked,
  showCementSpots = false,
  onToggleCementSpots,
  cementCount,
  selectedSpot,
  movingSpot,
  onStartMoveSpot,
}: CoordinatesHUDProps) => {
  const [copied, setCopied] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [showRawCoords, setShowRawCoords] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fivem_map_show_raw_coords') === 'true';
    } catch {
      return false;
    }
  });
  const toolsRef = useRef<HTMLDivElement>(null);
  const [liveCoords, setLiveCoords] = useState<{ x: number; y: number } | null>(() => coordsBus.getCoords());

  const handleToggleRawCoords = () => {
    setShowRawCoords((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fivem_map_show_raw_coords', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    return coordsBus.subscribe((coords) => {
      setLiveCoords(coords);
    });
  }, []);

  useEffect(() => {
    if (!toolsOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [toolsOpen]);

  const activeToolsCount = Number(showCrosshair) + Number(Boolean(isGhostMode)) + Number(!isCompactMode) + Number(!showCementSpots);

  const activeCoords = isCoordsLocked && lockedCoords ? lockedCoords : (propCoords || liveCoords);

  const handleCopy = () => {
    if (!activeCoords) return;
    const text = `${activeCoords.x.toFixed(1)}, ${activeCoords.y.toFixed(1)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={`absolute bottom-4 left-4 z-[1000] flex flex-wrap items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border shadow-2xl text-xs font-mono text-slate-200 pointer-events-auto select-none transition-all duration-200 ${
        isCoordsLocked
          ? 'border-cyan-500/80 shadow-cyan-500/20 ring-1 ring-cyan-500/30'
          : 'border-slate-700/80'
      }`}
    >
      {/* 1. Optional Raw GPS / Locked Coordinates (Hidden by default for regular players) */}
      {(showRawCoords || isCoordsLocked) && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`flex items-center gap-1 font-semibold shrink-0 transition-colors ${
                isCoordsLocked ? 'text-cyan-400' : 'text-amber-400'
              }`}
            >
              {isCoordsLocked ? (
                <Lock className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              ) : (
                <Crosshair className="w-3.5 h-3.5 animate-pulse" />
              )}
              <span>{isCoordsLocked ? 'LOCKED:' : 'GPS:'}</span>
            </div>

            <div className="flex items-center gap-2 tabular-nums">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">X:</span>
                <span
                  className={`inline-block w-[64px] font-bold text-left transition-colors ${
                    isCoordsLocked
                      ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'text-emerald-400'
                  }`}
                >
                  {activeCoords ? activeCoords.x.toFixed(1) : '---.-'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">Y:</span>
                <span
                  className={`inline-block w-[64px] font-bold text-left transition-colors ${
                    isCoordsLocked
                      ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'text-emerald-400'
                  }`}
                >
                  {activeCoords ? activeCoords.y.toFixed(1) : '---.-'}
                </span>
              </div>
            </div>

            <button
              onClick={handleCopy}
              disabled={!activeCoords}
              title={
                activeCoords
                  ? `คลิกเพื่อคัดลอกพิกัด X, Y (${isCoordsLocked ? 'พิกัดที่ล็อคไว้' : 'พิกัดปัจจุบัน'})`
                  : 'เลื่อนเมาส์บนแผนที่เพื่อดูพิกัด'
              }
              className={`flex items-center justify-center gap-1 px-2 py-0.5 rounded transition-colors text-[11px] border shrink-0 ${
                activeCoords
                  ? isCoordsLocked
                    ? 'bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-200 border-cyan-500/50 cursor-pointer shadow-sm'
                    : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border-slate-700 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>พิกัด</span>
                </>
              )}
            </button>
          </div>

          <div className="h-3 w-[1px] bg-slate-700 mx-0.5 hidden sm:block shrink-0" />
        </>
      )}

      {/* 2. Map Info (Layer & Zoom) */}
      <div className="hidden sm:flex items-center gap-1 text-slate-400 shrink-0">
        <Layers className="w-3 h-3 text-slate-500" />
        <span className="max-w-[80px] truncate">{activeLayerName}</span>
      </div>

      <div className="h-3 w-[1px] bg-slate-700 mx-0.5 hidden sm:block shrink-0" />

      <div className="text-slate-400 shrink-0 flex items-center gap-1">
        <span>Zoom:</span>
        <strong className="text-slate-200 tabular-nums inline-block w-[20px] text-center">
          {zoom}
        </strong>
      </div>

      <div className="h-3 w-[1px] bg-slate-700 mx-0.5 shrink-0" />

      {/* 3. Action Buttons (Rock-solid position, zero jitter) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Move Selected Spot Button */}
        {selectedSpot && !movingSpot && onStartMoveSpot && (
          <button
            onClick={() => onStartMoveSpot(selectedSpot)}
            title={`ย้ายตำแหน่งหมุด "${selectedSpot.name}" บนแผนที่`}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer animate-in fade-in"
          >
            <Compass className="w-3 h-3 text-amber-400" />
            <span>ย้ายตำแหน่งหมุด</span>
          </button>
        )}

        {/* Lock Coordinates Toggle (Only shown when raw coords mode or locked) */}
        {(showRawCoords || isCoordsLocked) && onToggleLockCoords && (
          <button
            onClick={onToggleLockCoords}
            title={
              isCoordsLocked
                ? 'คลิกเพื่อปลดล็อค หรือกด [Space]'
                : 'ล็อคพิกัดตรงนี้ ไม่ให้เลื่อนตามเมาส์ (กด Space)'
            }
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
              isCoordsLocked
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/70 shadow-md shadow-cyan-500/30 font-bold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {isCoordsLocked ? (
              <>
                <Unlock className="w-3 h-3 text-cyan-300" />
                <span>ปลดล็อค [Space]</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-slate-400" />
                <span>ล็อค [Space]</span>
              </>
            )}
          </button>
        )}

        {/* Pin at Locked Coords */}
        {isCoordsLocked && onPinAtLocked && (
          <button
            onClick={onPinAtLocked}
            title="สร้างมาร์คใหม่ตรงพิกัดที่ล็อคไว้ทันที"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition-all shadow-md shadow-cyan-500/40 animate-in fade-in"
          >
            <Target className="w-3 h-3" />
            <span>🎯 ปักจุดที่ล็อค</span>
          </button>
        )}

        {/* Pin at Crosshair Center */}
        {showCrosshair && onPinAtCrosshair && (
          <button
            onClick={onPinAtCrosshair}
            title="สร้างมาร์คใหม่ตรงจุดตัดเป้าเล็งกลางจอ (แม่นยำ 100%)"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all shadow-md shadow-amber-500/30 animate-in fade-in cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            <span>ปักตรงเป้า</span>
          </button>
        )}

        {/* Map View Tools Popover (Keeps bottom HUD compact on all screens) */}
        <div className="relative" ref={toolsRef}>
          <button
            type="button"
            onClick={() => setToolsOpen((prev) => !prev)}
            aria-expanded={toolsOpen}
            title="ตั้งค่าเป้าเล็ง รูปแบบหมุด และโหมดโปร่งแสง"
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
              toolsOpen || activeToolsCount > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">เครื่องมือแมพ</span>
            {activeToolsCount > 0 && (
              <span className="px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black leading-tight">
                {activeToolsCount}
              </span>
            )}
          </button>

          {toolsOpen && (
            <div className="absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-60 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 space-y-1.5 z-[1100] animate-in fade-in slide-in-from-top-2">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                การแสดงผลบนแผนที่
              </div>

              <button
                type="button"
                onClick={onToggleCrosshair}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                  showCrosshair
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>เป้าเล็งกลางจอ (Crosshair)</span>
                </span>
                <span className="text-[10px] font-mono">{showCrosshair ? 'ON' : 'OFF'}</span>
              </button>

              {onToggleCompactMode && (
                <button
                  type="button"
                  onClick={onToggleCompactMode}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                    isCompactMode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                      : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{isCompactMode ? '🎯' : '📍'}</span>
                    <span>{isCompactMode ? 'ไอคอน: เรดาร์ (Blip)' : 'ไอคอน: หมุดปัก (Pin)'}</span>
                  </span>
                </button>
              )}

              {onToggleGhostMode && (
                <button
                  type="button"
                  onClick={onToggleGhostMode}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                    isGhostMode
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                      : 'bg-slate-800/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>👻</span>
                    <span>โหมดโปร่งแสง (ปักซ้อน)</span>
                  </span>
                  <span className="text-[10px] font-mono">{isGhostMode ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {onToggleCementSpots && (
                <button
                  type="button"
                  onClick={onToggleCementSpots}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                    showCementSpots
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>🧱</span>
                    <span>แสดงจุดปูน ({cementCount ?? 0})</span>
                  </span>
                  <span className="text-[10px] font-mono">{showCementSpots ? 'ON' : 'OFF'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleRawCoords}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors cursor-pointer ${
                  showRawCoords
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-800/70 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>แสดงเลขพิกัด X, Y (แอดมิน)</span>
                </span>
                <span className="text-[10px] font-mono">{showRawCoords ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

