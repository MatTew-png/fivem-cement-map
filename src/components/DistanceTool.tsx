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
  Weight,
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
  const [showVehicleRef, setShowVehicleRef] = useState(false);
  const [customWeight, setCustomWeight] = useState<number>(50); // Default to 50 kg medium load
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

  // FiveM Running Speed: ทุกคนวิ่งสปีดเท่ากันตอนตัวเปล่า ต่างกันที่น้ำหนัก
  // - 0-20 kg (ตัวเบา / ตัวเปล่า): สปรินต์เต็มพิกัด 7.0 m/s (~25.2 km/h)
  // - 50 kg (แบกปานกลาง): 5.68 m/s (~20.5 km/h)
  // - 100 kg (แบกหนัก / ปูนเต็มกระเป๋า): 3.5 m/s (~12.6 km/h)
  // - >100 kg (หนักเกินพิกัด): ลดลงจนถึง 2.0 m/s (~7.2 km/h)
  const calculateRunSpeed = (kg: number): number => {
    if (kg <= 20) return 7.0;
    if (kg >= 120) return 2.0;
    if (kg > 100) return 3.5 - ((kg - 100) / 20) * 1.5;
    return 7.0 - ((kg - 20) / 80) * 3.5;
  };

  // Fixed Presets:
  const lightSec = Math.round(totalDistance / 7.0);
  const medSec = Math.round(totalDistance / 5.68);
  const heavySec = Math.round(totalDistance / 3.5);

  // Dynamic Selected Weight:
  const selectedSpeed = calculateRunSpeed(customWeight);
  const selectedSec = Math.round(totalDistance / selectedSpeed);

  // Vehicle Estimates (อ้างอิง):
  const carSec = Math.round(totalDistance / 30.5); // ~110 km/h
  const truckSec = Math.round(totalDistance / 19.4); // ~70 km/h

  const handleCopySummary = () => {
    if (points.length === 0) return;
    const distText =
      totalDistance >= 1000
        ? `${(totalDistance / 1000).toFixed(2)} กม.`
        : `${totalDistance} เมตร`;

    let text = `📍 แผนรูทฟาร์ม (${points.length} จุด)\n`;
    text += `📏 ระยะทางรวม: ${distText}\n\n`;
    text += `🏃 เวลาวิ่งตามน้ำหนัก (ทุกคนสปีดเท่ากัน ต่างที่น้ำหนัก):\n`;
    text += `  • 🟢 ตัวเบา (0-20 กก.): ${formatDuration(lightSec)}\n`;
    text += `  • 🟡 แบกปานกลาง (50 กก.): ${formatDuration(medSec)}\n`;
    text += `  • 🔴 แบกหนัก/ปูนเต็ม (100 กก.): ${formatDuration(heavySec)}\n`;
    if (customWeight !== 0 && customWeight !== 50 && customWeight !== 100) {
      text += `  • 🎒 น้ำหนักที่เลือก (${customWeight} กก.): ${formatDuration(selectedSec)}\n`;
    }
    text += `\n🚗 ขับรถพาหนะ (อ้างอิง):\n`;
    text += `  • รถเร็ว (~110 กม./ชม.): ${formatDuration(carSec)}\n`;
    text += `  • รถขนส่ง (~70 กม./ชม.): ${formatDuration(truckSec)}\n`;

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
        <Ruler className="w-4 h-4" />
        <span className="hidden sm:inline">
          {isActive ? 'โหมดวัดระยะทาง (เปิด)' : 'วัดระยะทาง / รูทฟาร์ม'}
        </span>
        <span className="sm:hidden">
          {isActive ? 'วัดระยะ (เปิด)' : 'วัดระยะ'}
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

            {/* Weight-Based Running Time Section (ทุกคนสปีดเท่ากัน ต่างที่น้ำหนัก) */}
            {totalDistance > 0 && (
              <div className="pt-2 mt-1 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                    <Footprints className="w-3.5 h-3.5 text-amber-400" />
                    <span>เวลาวิ่งตามน้ำหนัก</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">
                    ทุกคนสปีดเท่ากัน ต่างที่น้ำหนัก
                  </span>
                </div>

                {/* 3 Preset Weight Cards */}
                <div className="space-y-1 text-[11px] font-mono">
                  {/* Light / Empty */}
                  <div
                    onClick={() => setCustomWeight(0)}
                    className={`flex justify-between items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                      customWeight === 0
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                        : 'bg-slate-950/50 border-slate-800/70 text-slate-300 hover:border-slate-700'
                    }`}
                    title="คลิกเพื่อเลือกน้ำหนักนี้"
                  >
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>ตัวเบา (0-20 กก.):</span>
                    </span>
                    <span className="font-semibold text-emerald-300">
                      {formatDuration(lightSec)}
                    </span>
                  </div>

                  {/* Medium Load */}
                  <div
                    onClick={() => setCustomWeight(50)}
                    className={`flex justify-between items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                      customWeight === 50
                        ? 'bg-amber-950/40 border-amber-500/60 text-white'
                        : 'bg-slate-950/50 border-slate-800/70 text-slate-300 hover:border-slate-700'
                    }`}
                    title="คลิกเพื่อเลือกน้ำหนักนี้"
                  >
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>แบกปานกลาง (50 กก.):</span>
                    </span>
                    <span className="font-semibold text-amber-300">
                      {formatDuration(medSec)}
                    </span>
                  </div>

                  {/* Heavy Load / Full Cement */}
                  <div
                    onClick={() => setCustomWeight(100)}
                    className={`flex justify-between items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                      customWeight === 100
                        ? 'bg-rose-950/40 border-rose-500/60 text-white'
                        : 'bg-slate-950/50 border-slate-800/70 text-slate-300 hover:border-slate-700'
                    }`}
                    title="คลิกเพื่อเลือกน้ำหนักนี้"
                  >
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span>แบกหนัก/ปูนเต็ม (100 กก.):</span>
                    </span>
                    <span className="font-semibold text-rose-300">
                      {formatDuration(heavySec)}
                    </span>
                  </div>
                </div>

                {/* Interactive Weight Slider & Custom Calculator */}
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400 font-sans">
                      <Weight className="w-3.5 h-3.5 text-amber-400" />
                      <span>ปรับน้ำหนักกระเป๋า:</span>
                    </span>
                    <span className="font-bold text-amber-300 font-mono">
                      {customWeight} กก.
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex gap-1 pt-0.5">
                    {[0, 30, 50, 80, 100].map((kg) => (
                      <button
                        key={kg}
                        type="button"
                        onClick={() => setCustomWeight(kg)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          customWeight === kg
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {kg}k
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={5}
                    value={customWeight}
                    onChange={(e) => setCustomWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5 font-mono">
                    <span>ความเร็ว: {(selectedSpeed * 3.6).toFixed(1)} กม./ชม.</span>
                    <span className="text-amber-300 font-bold text-[11px]">
                      เวลา: {formatDuration(selectedSec)}
                    </span>
                  </div>
                </div>

                {/* Collapsible Vehicle Reference (เวลาขับรถ) */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowVehicleRef((prev) => !prev)}
                    className="w-full flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-300 transition-colors py-0.5 cursor-pointer font-sans"
                  >
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3 text-slate-500" />
                      <span>ดูเวลาขับรถ (สำหรับพาหนะ)</span>
                    </span>
                    {showVehicleRef ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showVehicleRef && (
                    <div className="mt-1 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 space-y-1 text-[10px] font-mono text-slate-400">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-amber-400/80" />
                          <span>รถเร็ว (~110 กม./ชม.):</span>
                        </span>
                        <span className="text-amber-300/90">{formatDuration(carSec)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3 text-cyan-400/80" />
                          <span>รถขนส่ง (~70 กม./ชม.):</span>
                        </span>
                        <span className="text-cyan-300/90">{formatDuration(truckSec)}</span>
                      </div>
                    </div>
                  )}
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
