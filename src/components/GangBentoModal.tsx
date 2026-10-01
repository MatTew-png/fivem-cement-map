import React, { useMemo } from 'react';
import {
  X,
  LayoutGrid,
  ShieldCheck,
  Flame,
  Clock,
  Users,
  MapPin,
  Lock,
  Radio,
  Smartphone,
  Monitor,
} from 'lucide-react';
import type { CementSpot, ActiveCooldown } from '../types/map';
import type { OnlineMember } from '../utils/presence';
import type { ActivityLog, GangSession } from '../utils/gangAuth';
import { getDailyPIN } from '../utils/gangAuth';
import { isCementSpot } from '../data/defaultSpots';

interface GangBentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: CementSpot[];
  activeCooldowns: ActiveCooldown[];
  onlineMembers: OnlineMember[];
  activityLogs: ActivityLog[];
  currentSession: GangSession | null;
  onOpenPresence: () => void;
}

export const GangBentoModal: React.FC<GangBentoModalProps> = ({
  isOpen,
  onClose,
  spots,
  activeCooldowns,
  onlineMembers,
  activityLogs,
  currentSession,
  onOpenPresence,
}) => {
  if (!isOpen) return null;

  const now = Date.now();
  const dailyPin = getDailyPIN();

  // Statistics calculation
  const cementCount = useMemo(() => spots.filter((s) => isCementSpot(s)).length, [spots]);
  const landmarkCount = spots.length - cementCount;
  const weedSpotsCount = useMemo(() => spots.filter((s) => s.icon?.includes('weed') || s.name.includes('ยา') || s.name.toLowerCase().includes('weed')).length, [spots]);

  // Urgent cooldowns
  const urgentCount = useMemo(() => {
    return activeCooldowns.filter((cd) => {
      const rem = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
      return rem > 0 && rem <= 180;
    }).length;
  }, [activeCooldowns, now]);

  // Next ready cooldown spot
  const nextReady = useMemo(() => {
    if (activeCooldowns.length === 0) return null;
    const sorted = [...activeCooldowns].sort((a, b) => a.expiresAt - b.expiresAt);
    const closest = sorted[0];
    const spot = spots.find((s) => s.id === closest.spotId);
    const remMin = Math.max(1, Math.ceil((closest.expiresAt - now) / 60000));
    return { name: spot?.name || 'หมุดคูลดาวน์', minutes: remMin };
  }, [activeCooldowns, spots, now]);

  return (
    <div className="fixed inset-0 z-[9992] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <LayoutGrid className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Tactical Intel Dashboard
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold">
                  BENTO GRID
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ศูนย์ข้อมูลสถิติ เรดาร์พิกัด และสถานะเครือข่ายแก๊งรันทุกเวิบ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NameThatUI Pattern: Bento Grid Layout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 auto-rows-min">
            
            {/* TILE 1: Spot Breakdown (Span 2 cols, 2 rows) */}
            <div className="sm:col-span-2 md:row-span-2 p-5 rounded-3xl bg-gradient-to-br from-slate-950/80 via-slate-900 to-slate-950/90 border border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-400 pointer-events-none group-hover:scale-110 transition-transform">
                <MapPin className="w-32 h-32" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <MapPin className="w-4 h-4" />
                    <span>ความครอบคลุมพิกัด (Map Coverage)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                    P2P Synced
                  </span>
                </div>

                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight my-2">
                  {spots.length} <span className="text-lg font-bold text-slate-400">จุดทั้งหมด</span>
                </div>
                <p className="text-xs text-slate-400">
                  ฐานข้อมูลพิกัดและตำแหน่งฟาร์มสำคัญ สำเนาสดบนแผนที่ GTA V
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 mt-4">
                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-center">
                  <div className="text-lg font-black text-amber-300">{cementCount}</div>
                  <div className="text-[10px] text-amber-400/80 font-semibold">จุดปูนซีเมนต์</div>
                </div>

                <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/30 text-center">
                  <div className="text-lg font-black text-sky-300">{landmarkCount}</div>
                  <div className="text-[10px] text-sky-400/80 font-semibold">แลนด์มาร์ค</div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center">
                  <div className="text-lg font-black text-emerald-300">{weedSpotsCount}</div>
                  <div className="text-[10px] text-emerald-400/80 font-semibold">Dealer / กัญชา</div>
                </div>
              </div>
            </div>

            {/* TILE 2: Active Cooldowns (Span 1 col) */}
            <div className="p-4 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-red-400">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-400" />
                  <span>คูลดาวน์สด</span>
                </span>
                {urgentCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                )}
              </div>

              <div className="my-2">
                <div className="text-3xl font-black text-white font-mono">
                  {activeCooldowns.length} <span className="text-xs font-sans text-slate-400">จุด</span>
                </div>
                {urgentCount > 0 ? (
                  <div className="text-[11px] text-red-300 font-bold mt-1 animate-pulse">
                    🔥 ใกล้เสร็จ {urgentCount} จุด (&le; 3 นาที)
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 mt-1">
                    {nextReady ? `จุดต่อไป: ${nextReady.minutes} น.` : 'ไม่มีจุดคูลดาวน์'}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                ซิงค์สดอัตโนมัติทั้งตี้
              </div>
            </div>

            {/* TILE 3: Security & Cipher Gate (Span 1 col) */}
            <div className="p-4 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>ความปลอดภัย</span>
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  E2EE
                </span>
              </div>

              <div className="my-2">
                <div className="text-[11px] text-slate-400 font-medium">รหัสประจำวันวันนี้:</div>
                <div className="text-2xl font-black text-amber-400 font-mono tracking-widest mt-0.5">
                  {dailyPin}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                  <span>Anti-Theft Active</span>
                </span>
                <span className="text-amber-400 font-bold">
                  {currentSession?.isMaster ? '👑 BOSS' : (currentSession?.memberName || 'MEMBER')}
                </span>
              </div>
            </div>

            {/* TILE 4: Online Roster & Mesh (Span 2 cols) */}
            <div className="sm:col-span-2 p-5 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    สมาชิกออนไลน์ ({onlineMembers.length} คน)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenPresence}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                >
                  เปิดดูศูนย์สมาชิก
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 my-2">
                {onlineMembers.map((m) => (
                  <div
                    key={m.clientId}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{m.memberName}</span>
                    {m.isMaster && <span className="text-[10px]">👑</span>}
                    {m.device === 'Mobile' ? (
                      <Smartphone className="w-2.5 h-2.5 text-slate-400" />
                    ) : (
                      <Monitor className="w-2.5 h-2.5 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>HiveMQ MQTT WebSocket Mesh • 0 Quota Limit</span>
                </span>
              </div>
            </div>

            {/* TILE 5: Recent Operations Stream (Span 2 cols) */}
            <div className="sm:col-span-2 p-5 rounded-3xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    กิจกรรมล่าสุด (Live Operations)
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {activityLogs.length} บันทึก
                </span>
              </div>

              <div className="space-y-1.5 my-1">
                {activityLogs.slice(0, 3).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span>{log.action === 'login' ? '🟢' : log.action === 'cooldown_start' ? '🔥' : '📍'}</span>
                      <span className="font-bold text-white shrink-0">{log.memberName}</span>
                      <span className="text-slate-400 text-[11px] truncate">{log.details}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {activityLogs.length === 0 && (
                  <div className="text-center py-3 text-slate-500 text-xs">
                    ยังไม่มีกิจกรรมในเซสชั่นนี้
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80">
                บันทึกการทำงานแบบเรียลไทม์ผ่าน WebSocket
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px]">
            ⚡ Powered by NameThatUI Design System Architecture
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
