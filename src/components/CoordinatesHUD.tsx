import { useState } from 'react';
import { Crosshair, Copy, Check, Layers, Target } from 'lucide-react';

interface CoordinatesHUDProps {
  cursorCoords: { x: number; y: number } | null;
  zoom: number;
  activeLayerName: string;
  showCrosshair: boolean;
  onToggleCrosshair: () => void;
}

export const CoordinatesHUD = ({
  cursorCoords,
  zoom,
  activeLayerName,
  showCrosshair,
  onToggleCrosshair,
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
    <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/70 shadow-2xl text-xs font-mono text-slate-200 pointer-events-auto select-none">
      <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
        <Crosshair className="w-3.5 h-3.5 animate-pulse" />
        <span>GPS:</span>
      </div>

      {cursorCoords ? (
        <div className="flex items-center gap-2">
          <span>
            X: <strong className="text-emerald-400">{cursorCoords.x.toFixed(1)}</strong>
          </span>
          <span>
            Y: <strong className="text-emerald-400">{cursorCoords.y.toFixed(1)}</strong>
          </span>
          <button
            onClick={handleCopy}
            title="คลิกเพื่อคัดลอก /tp x y z"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 transition-colors text-[11px] text-slate-300 ml-1 border border-slate-700"
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
      ) : (
        <span className="text-slate-400 italic">เลื่อนเมาส์บนแผนที่</span>
      )}

      <div className="h-3 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

      <div className="hidden sm:flex items-center gap-1 text-slate-400">
        <Layers className="w-3 h-3 text-slate-500" />
        <span>{activeLayerName}</span>
      </div>

      <div className="h-3 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

      <div className="text-slate-400">
        Zoom: <strong className="text-slate-200">{zoom}</strong>
      </div>

      <div className="h-3 w-[1px] bg-slate-700 mx-1" />

      {/* Crosshair Toggle */}
      <button
        onClick={onToggleCrosshair}
        title="เปิด/ปิด เป้ากากบาท GTA V กลางแผนที่"
        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
          showCrosshair
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
        }`}
      >
        <Target className="w-3 h-3" />
        <span>เป้าเล็ง</span>
      </button>
    </div>
  );
};
