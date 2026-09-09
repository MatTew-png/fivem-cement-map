import { useState } from 'react';
import {
  Ruler,
  X,
  RotateCcw,
  Undo2,
  Repeat,
  Copy,
  Check,
  Truck,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DistancePoint } from '../types/map';

export interface RouteSegment {
  fromLabel: string;
  toLabel: string;
  distance: number;
}

interface DistanceToolProps {
  isActive: boolean;
  onToggle: () => void;
  points: DistancePoint[];
  totalDistance: number;
  segments: RouteSegment[];
  onClear: () => void;
  onUndo: () => void;
  onLoop: () => void;
}

export const DistanceTool = ({
  isActive,
  onToggle,
  points,
  totalDistance,
  segments,
  onClear,
  onUndo,
  onLoop,
}: DistanceToolProps) => {
  const [showLegs, setShowLegs] = useState(false);
  const [copied, setCopied] = useState(false);

  // Speed estimates in GTA V:
  // Car at ~110 km/h = 30.5 m/s
  const carSec = Math.round(totalDistance / 30.5);
  const carMin = Math.floor(carSec / 60);
  const carRemSec = carSec % 60;

  // Truck / Transport at ~70 km/h = 19.4 m/s
  const truckSec = Math.round(totalDistance / 19.4);
  const truckMin = Math.floor(truckSec / 60);
  const truckRemSec = truckSec % 60;

  const handleCopySummary = () => {
    if (points.length === 0) return;
    const distText =
      totalDistance >= 1000
        ? `${(totalDistance / 1000).toFixed(2)} กม.`
        : `${totalDistance} เมตร`;

    let text = `📍 แผนรูทฟาร์ม (${points.length} จุด)\n`;
    text += `📏 ระยะทางรวม: ${distText}\n`;
    text += `🚗 ขับรถเร็ว: ${carMin > 0 ? `${carMin} นาที ` : ''}${carRemSec} วินาที\n`;
    text += `🚚 รถบรรทุก/ปิคอัพ: ${truckMin > 0 ? `${truckMin} นาที ` : ''}${truckRemSec} วินาที\n`;

    if (segments.length > 0) {
      text += `\nลำดับการฟาร์ม:\n`;
      segments.forEach((seg, idx) => {
        const segDist =
          seg.distance >= 1000
            ? `${(seg.distance / 1000).toFixed(2)} กม.`
            : `${seg.distance} ม.`;
        text += `${idx + 1}. ${seg.fromLabel} ➔ ${seg.toLabel} (${segDist})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLooped =
    points.length >= 3 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y;

  return (
    <div className="absolute top-16 right-4 sm:top-4 sm:right-72 z-[1000] flex flex-col items-end gap-2 select-none pointer-events-auto">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold backdrop-blur-md border shadow-2xl transition-all cursor-pointer ${
          isActive
            ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 shadow-amber-400/20'
            : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Ruler className="w-4 h-4" />
        <span>{isActive ? 'โหมดวัดระยะทาง (เปิด)' : 'วัดระยะทาง / รูทฟาร์ม'}</span>
        {points.length > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950 text-amber-300 border border-amber-400/40">
            {points.length} จุด
          </span>
        )}
      </button>

      {/* Floating Measuring & Routing Panel */}
      {isActive && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs text-slate-200 w-72 sm:w-80 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span>คำนวณระยะทาง & รูทฟาร์ม</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClear}
                title="ล้างจุดทั้งหมด"
                disabled={points.length === 0}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggle}
                title="ปิดเครื่องมือ"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Guide */}
          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
            🎯 <strong className="text-amber-300">คลิกที่จุดมาร์คปูน</strong> หรือคลิกบนถนนเพื่อต่อเส้นทางคำนวณ
          </p>

          {/* Metrics Box */}
          <div className="bg-slate-950/80 rounded-xl p-2.5 space-y-1.5 font-mono border border-slate-800/80">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-[11px] text-slate-400">จำนวนจุดในรูท:</span>
              <span className="font-bold text-slate-100">{points.length} จุด</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-[11px] text-slate-400">ระยะทางรวม:</span>
              <span className="font-bold text-base text-emerald-400">
                {totalDistance >= 1000
                  ? `${(totalDistance / 1000).toFixed(2)} กม.`
                  : `${totalDistance} เมตร`}
              </span>
            </div>

            {totalDistance > 0 && (
              <div className="pt-2 mt-1 border-t border-slate-800/80 space-y-1 text-[11px]">
                {/* Fast Car */}
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Car className="w-3.5 h-3.5 text-amber-400" />
                    <span>รถเร็ว (~110 กม./ชม.):</span>
                  </span>
                  <span className="text-amber-300 font-semibold">
                    {carMin > 0 ? `${carMin} น. ` : ''}
                    {carRemSec} วิ.
                  </span>
                </div>

                {/* Truck / Transport */}
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>รถขนส่ง (~70 กม./ชม.):</span>
                  </span>
                  <span className="text-cyan-300 font-semibold">
                    {truckMin > 0 ? `${truckMin} น. ` : ''}
                    {truckRemSec} วิ.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Route Segments Breakdown */}
          {segments.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowLegs((prev) => !prev)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <span>รายละเอียดแต่ละช่วง ({segments.length} ช่วง)</span>
                {showLegs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showLegs && (
                <div className="mt-1 max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10px] text-slate-300">
                  {segments.map((seg, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/60"
                    >
                      <div className="truncate max-w-[170px]" title={`${seg.fromLabel} ➔ ${seg.toLabel}`}>
                        <span className="text-amber-400 font-bold">{idx + 1}.</span> {seg.fromLabel} ➔ {seg.toLabel}
                      </div>
                      <span className="text-emerald-400 font-bold shrink-0 ml-1">
                        {seg.distance >= 1000
                          ? `${(seg.distance / 1000).toFixed(2)} กม.`
                          : `${seg.distance} ม.`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
            {/* Undo */}
            <button
              type="button"
              onClick={onUndo}
              disabled={points.length === 0}
              className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="ลบจุดล่าสุดที่คลิก"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>

            {/* Loop back to start */}
            <button
              type="button"
              onClick={onLoop}
              disabled={points.length < 2 || isLooped}
              className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="วนกลับมาจุดเริ่มต้นเพื่อจบลูปวงกลม"
            >
              <Repeat className="w-3.5 h-3.5 text-cyan-400" />
              <span>วนจบลูป</span>
            </button>

            {/* Copy Summary */}
            <button
              type="button"
              onClick={handleCopySummary}
              disabled={points.length === 0}
              className={`py-1.5 px-2 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="คัดลอกสรุปเส้นทาง"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
