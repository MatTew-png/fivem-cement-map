import { useState } from 'react';
import { Crosshair, Copy, Check, Layers, Target } from 'lucide-react';

interface CoordinatesHUDProps {
  cursorCoords: { x: number; y: number } | null;
  zoom: number;
  activeLayerName: string;
  showCrosshair: boolean;
  onToggleCrosshair: () => void;
  onPinAtCrosshair?: () => void;
  isCompactMode?: boolean;
  onToggleCompactMode?: () => void;
  isGhostMode?: boolean;
  onToggleGhostMode?: () => void;
}

export const CoordinatesHUD = ({
  cursorCoords,
  zoom,
  activeLayerName,
  showCrosshair,
  onToggleCrosshair,
  onPinAtCrosshair,
  isCompactMode,
  onToggleCompactMode,
  isGhostMode,
  onToggleGhostMode,
}: CoordinatesHUDProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!cursorCoords) return;
    const text = `/tp ${cursorCoords.x.toFixed(1)} ${cursorCoords.y.toFixed(1)} 30.0`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-2xl text-xs font-mono text-slate-200 pointer-events-auto select-none">
      {/* 1. Fixed-Width GPS Coordinates Slot (Zero Layout Shift & Jitter) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 text-amber-400 font-semibold shrink-0">
          <Crosshair className="w-3.5 h-3.5 animate-pulse" />
          <span>GPS:</span>
        </div>

        <div className="flex items-center gap-2 tabular-nums">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">X:</span>
            <span className="inline-block w-[64px] text-emerald-400 font-bold text-left">
              {cursorCoords ? cursorCoords.x.toFixed(1) : '---.-'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">Y:</span>
            <span className="inline-block w-[64px] text-emerald-400 font-bold text-left">
              {cursorCoords ? cursorCoords.y.toFixed(1) : '---.-'}
            </span>
          </div>
        </div>

        {/* Fixed Width /tp button */}
        <button
          onClick={handleCopy}
          disabled={!cursorCoords}
          title={cursorCoords ? 'คลิกเพื่อคัดลอก /tp x y z' : 'เลื่อนเมาส์บนแผนที่เพื่อดูพิกัด'}
          className={`flex items-center justify-center gap-1 w-[54px] py-0.5 rounded transition-colors text-[11px] border shrink-0 ${
            cursorCoords
              ? 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border-slate-700 cursor-pointer'
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
              <span>/tp</span>
            </>
          )}
        </button>
      </div>

      <div className="h-3 w-[1px] bg-slate-700 mx-0.5 hidden sm:block shrink-0" />

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
        {/* Crosshair Toggle */}
        <button
          onClick={onToggleCrosshair}
          title="เปิด/ปิด เป้ากากบาท GTA V กลางแผนที่"
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
            showCrosshair
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          <Target className="w-3 h-3" />
          <span>เป้าเล็ง</span>
        </button>

        {/* Pin at Crosshair Center */}
        {showCrosshair && onPinAtCrosshair && (
          <button
            onClick={onPinAtCrosshair}
            title="สร้างมาร์คใหม่ตรงจุดตัดเป้าเล็งกลางจอ (แม่นยำ 100%)"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all shadow-md shadow-amber-500/30 animate-in fade-in"
          >
            <Crosshair className="w-3 h-3" />
            <span>🎯 ปักตรงเป้า</span>
          </button>
        )}

        {/* Compact Mode Toggle */}
        {onToggleCompactMode && (
          <button
            onClick={onToggleCompactMode}
            title="สลับเป็นหมุดจุดจิ๋ว เพื่อไม่ให้บังพื้นที่และปักจุดติดๆ กันได้ง่าย"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
              isCompactMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span>🔘</span>
            <span>{isCompactMode ? 'หมุดจิ๋ว (เปิด)' : 'หมุดจิ๋ว'}</span>
          </button>
        )}

        {/* Ghost Mode Toggle */}
        {onToggleGhostMode && (
          <button
            onClick={onToggleGhostMode}
            title="ทำให้หมุดอื่นโปร่งแสง เพื่อให้ดับเบิ้ลคลิกปักจุดใหม่ที่อยู่ติดกันได้โดยไม่ติดหมุดเดิม"
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
              isGhostMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span>👻</span>
            <span>{isGhostMode ? 'โปร่งแสง (เปิด)' : 'โปร่งแสง'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
