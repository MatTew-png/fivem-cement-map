import React from 'react';
import { Ruler, X, RotateCcw } from 'lucide-react';

interface DistanceToolProps {
  isActive: boolean;
  onToggle: () => void;
  points: { x: number; y: number }[];
  totalDistance: number;
  onClear: () => void;
}

export const DistanceTool: React.FC<DistanceToolProps> = ({
  isActive,
  onToggle,
  points,
  totalDistance,
  onClear,
}) => {
  // Estimated drive time at 110 km/h (~30.5 m/s) in game
  const estimatedSeconds = Math.round(totalDistance / 30.5);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;

  return (
    <div className="absolute top-16 right-4 sm:top-4 sm:right-64 z-[1000] flex flex-col items-end gap-2">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold backdrop-blur-md border shadow-2xl transition-all ${
          isActive
            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40'
            : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Ruler className="w-4 h-4" />
        <span>{isActive ? 'โหมดวัดระยะทาง (เปิดอยู่)' : 'วัดระยะทาง'}</span>
      </button>

      {isActive && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs text-slate-200 w-64 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
            <span className="font-bold text-amber-400">เครื่องมือวัดระยะทาง</span>
            <div className="flex items-center gap-1">
              <button
                onClick={onClear}
                title="ล้างจุดวัด"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggle}
                title="ปิด"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mb-2">
            คลิกบนแผนที่เพื่อสร้างจุดวัดระยะทาง (คลิกจุด A ไปจุด B)
          </p>

          <div className="bg-slate-950/70 rounded-xl p-2.5 space-y-1 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>จำนวนจุด:</span>
              <span className="font-bold text-slate-100">{points.length} จุด</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>ระยะทางรวม:</span>
              <span className="font-bold text-emerald-400">
                {totalDistance > 1000
                  ? `${(totalDistance / 1000).toFixed(2)} กม.`
                  : `${totalDistance} เมตร`}
              </span>
            </div>
            {totalDistance > 0 && (
              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>เวลาขับรถโดยประมาณ:</span>
                <span className="text-amber-300 font-medium">
                  {minutes > 0 ? `${minutes} น. ` : ''}{seconds} วิ.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
