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
  Footprints,
  Clock,
  Navigation,
} from 'lucide-react';
import type { DistancePoint, RoutingMode, CementSpot } from '../types/map';

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
  routingMode: RoutingMode;
  onToggleRoutingMode: (mode: RoutingMode) => void;
  spots?: CementSpot[];
  onSetRoutePair?: (start: CementSpot, end: CementSpot) => void;
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
  routingMode,
  onToggleRoutingMode,
  spots = [],
  onSetRoutePair,
  onClear,
  onUndo,
  onLoop,
}: DistanceToolProps) => {
  const [showLegs, setShowLegs] = useState(false);
  const [showPairSelector, setShowPairSelector] = useState(false);
  const [startSpotId, setStartSpotId] = useState<string>('');
  const [endSpotId, setEndSpotId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Helper format time (e.g. "1 น. 24 วิ." หรือ "45 วิ.")
  const formatDuration = (totalSec: number) => {
    if (totalSec <= 0) return '0 วิ.';
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) {
      return `${min} น. ${sec} วิ.`;
    }
    return `${sec} วิ.`;
  };

  // Realistic travel times in FiveM:
  // - วิ่งสปรินต์ (Sprint): ~7.0 m/s (~25.2 km/h)
  // - รถเร็ว / พาหนะทั่วไป (~110 km/h): ~30.5 m/s
  // - รถขนส่ง / บรรทุก (~70 km/h): ~19.4 m/s
  const sprintSec = Math.round(totalDistance / 7.0);
  const carSec = Math.round(totalDistance / 30.5);
  const truckSec = Math.round(totalDistance / 19.4);

  const handleCopySummary = () => {
    if (points.length === 0) return;
    const distText =
      totalDistance >= 1000
        ? `${(totalDistance / 1000).toFixed(2)} กม.`
        : `${totalDistance} เมตร`;

    const modeText = routingMode === 'road' ? '🛣️ ตามถนนจริง (GPS)' : '📏 เส้นตรง (Air Distance)';

    let text = `📍 แผนรูทการเดินทาง (${points.length} จุด)\n`;
    text += `🗺️ โหมด: ${modeText}\n`;
    text += `📏 ระยะทางรวม: ${distText}\n\n`;
    text += `⏱️ ประมาณการเวลาเดินทาง:\n`;
    text += `  • 🚗 รถเร็ว / ทั่วไป (~110 กม./ชม.): ${formatDuration(carSec)}\n`;
    text += `  • 🚛 รถขนส่ง (~70 กม./ชม.): ${formatDuration(truckSec)}\n`;
    text += `  • 🏃 วิ่งสปรินต์ (~25 กม./ชม.): ${formatDuration(sprintSec)}\n`;

    if (segments.length > 0) {
      text += `\nลำดับเส้นทาง:\n`;
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
    <div className="relative flex flex-col items-end pointer-events-auto select-none">
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
        {routingMode === 'road' ? <Navigation className="w-4 h-4" /> : <Ruler className="w-4 h-4" />}
        <span className="hidden sm:inline">
          {isActive
            ? routingMode === 'road'
              ? 'GPS นำทางตามถนน (เปิด)'
              : 'วัดระยะทางเส้นตรง (เปิด)'
            : 'GPS นำทาง / วัดระยะ'}
        </span>
        <span className="sm:hidden">
          {isActive ? 'GPS (เปิด)' : 'GPS'}
        </span>
        {points.length > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950 text-amber-300 border border-amber-400/40">
            {points.length} จุด
          </span>
        )}
      </button>

      {/* Floating Measuring & Routing Panel */}
      {isActive && (
        <div className="fixed inset-x-4 top-16 sm:inset-auto sm:absolute sm:top-full sm:right-0 sm:mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs text-slate-200 w-auto sm:w-84 max-h-[calc(100vh-6rem)] overflow-y-auto z-[1010] animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              {routingMode === 'road' ? (
                <Navigation className="w-4 h-4 text-amber-400" />
              ) : (
                <Ruler className="w-4 h-4 text-amber-400" />
              )}
              <span>{routingMode === 'road' ? 'GPS นำทางตามถนนจริง' : 'วัดระยะทางเส้นตรง'}</span>
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

          {/* Mode Switcher: Road GPS vs Straight Air Distance */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-2">
            <button
              type="button"
              onClick={() => onToggleRoutingMode('road')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                routingMode === 'road'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="คำนวณเส้นทางตามโค้งถนนจริงในเกม GTA V"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>🛣️ ทางถนน (GPS)</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleRoutingMode('straight')}
              className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                routingMode === 'straight'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="วัดระยะทางเส้นตรงข้ามตึก/ข้ามเขา (Air Distance)"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>📏 เส้นตรง (Air)</span>
            </button>
          </div>

          {/* Point-to-Point Direct Selector */}
          {spots && spots.length >= 2 && onSetRoutePair && (
            <div className="mb-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/70">
              <button
                type="button"
                onClick={() => setShowPairSelector((p) => !p)}
                className="w-full flex items-center justify-between text-[11px] text-amber-300 font-bold hover:text-amber-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-amber-400" />
                  <span>ตั้ง GPS จากจุดนึงไปจุดนึงทันที</span>
                </span>
                {showPairSelector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showPairSelector && (
                <div className="mt-2 space-y-1.5 pt-1.5 border-t border-slate-800/60 text-[11px]">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">🟢 จุดเริ่มต้น (Start):</label>
                    <select
                      value={startSpotId}
                      onChange={(e) => setStartSpotId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- เลือกจุดเริ่มต้น --</option>
                      {spots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.postal ? `#${s.postal}` : `${Math.round(s.x)}, ${Math.round(s.y)}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">🔴 จุดปลายทาง (Destination):</label>
                    <select
                      value={endSpotId}
                      onChange={(e) => setEndSpotId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- เลือกจุดปลายทาง --</option>
                      {spots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.postal ? `#${s.postal}` : `${Math.round(s.x)}, ${Math.round(s.y)}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!startSpotId || !endSpotId || startSpotId === endSpotId}
                    onClick={() => {
                      const s1 = spots.find((s) => s.id === startSpotId);
                      const s2 = spots.find((s) => s.id === endSpotId);
                      if (s1 && s2) {
                        onSetRoutePair(s1, s2);
                      }
                    }}
                    className="w-full mt-1 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-[11px] transition-all cursor-pointer shadow-md shadow-amber-400/20"
                  >
                    🚀 ตั้ง GPS นำทางทันที
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Guide */}
          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
            🎯 <strong className="text-amber-300">คลิกที่หมุดบนแผนที่</strong> หรือคลิกบนถนนเพื่อต่อเส้นทาง
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

            {/* Travel Time Estimation (เวลาเดินทางจริง: รถเร็ว, รถขนส่ง, วิ่งสปรินต์) */}
            {totalDistance > 0 && (
              <div className="pt-2 mt-1 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>ประมาณการเวลาเดินทาง</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ความเร็วเฉลี่ย
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  {/* Car / Fast Vehicle */}
                  <div className="flex justify-between items-center p-2 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Car className="w-3.5 h-3.5 text-amber-400" />
                      <span>รถเร็ว (~110 กม./ชม.):</span>
                    </span>
                    <span className="font-bold text-amber-300">
                      {formatDuration(carSec)}
                    </span>
                  </div>

                  {/* Truck / Transport */}
                  <div className="flex justify-between items-center p-2 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                    <span className="flex items-center gap-1.5 text-cyan-300">
                      <Truck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>รถขนส่ง (~70 กม./ชม.):</span>
                    </span>
                    <span className="font-bold text-cyan-300">
                      {formatDuration(truckSec)}
                    </span>
                  </div>

                  {/* Sprint / Character Run */}
                  <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                      <span>วิ่งสปรินต์ (~25 กม./ชม.):</span>
                    </span>
                    <span className="font-bold text-emerald-300">
                      {formatDuration(sprintSec)}
                    </span>
                  </div>
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
