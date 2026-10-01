import React, { useState } from 'react';
import {
  Users,
  Clock,
  Crown,
  Copy,
  Check,
  X,
  LogOut,
  Calendar,
  Smartphone,
  Monitor,
} from 'lucide-react';
import type { OnlineMember } from '../utils/presence';
import type { ActivityLog, GangSession } from '../utils/gangAuth';
import { getUpcomingPINs, formatPINsForDiscord, logoutGang } from '../utils/gangAuth';

interface GangPresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onlineMembers: OnlineMember[];
  activityLogs: ActivityLog[];
  currentSession: GangSession | null;
  onLogout: () => void;
}

export const GangPresenceModal: React.FC<GangPresenceModalProps> = ({
  isOpen,
  onClose,
  onlineMembers,
  activityLogs,
  currentSession,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'online' | 'logs' | 'boss'>('online');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const upcomingPins = getUpcomingPINs(7);

  const handleCopyDiscord = () => {
    const text = formatPINsForDiscord();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatDuration = (timestamp: number) => {
    const min = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    if (min < 60) return `${min} นาทีที่แล้ว`;
    const hours = Math.floor(min / 60);
    return `${hours} ชม. ${min % 60} นาทีที่แล้ว`;
  };

  const formatTimeStr = (timestamp: number) => {
    const d = new Date(timestamp);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m} น.`;
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Users className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  ศูนย์รวมสมาชิกแก๊ง
                </h3>
                {/* NameThatUI Pattern: Status Dot (Presence Indicator) */}
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>ออนไลน์ {onlineMembers.length} คน</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                คุณล็อกอินในชื่อ: <span className="font-bold text-amber-400">{currentSession?.memberName || 'สมาชิก'}</span>
                {currentSession?.isMaster && ' (👑 หัวหน้าแก๊ง)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* NameThatUI Pattern: Avatar Group */}
            <div className="hidden sm:flex items-center -space-x-2 overflow-hidden py-1">
              {onlineMembers.slice(0, 4).map((m, idx) => (
                <div
                  key={m.clientId || idx}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full ring-2 ring-slate-900 bg-slate-800 text-[10px] font-bold text-slate-200 shadow-sm"
                  title={`${m.memberName} (${m.device || 'Online'})`}
                >
                  {m.isMaster ? '👑' : m.memberName.slice(0, 1).toUpperCase()}
                </div>
              ))}
              {onlineMembers.length > 4 && (
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full ring-2 ring-slate-900 bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                  +{onlineMembers.length - 4}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NameThatUI Pattern: Segmented Control (Mac / iOS Dark Glass Style) */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80">
          <div className="p-1 bg-slate-950/90 border border-slate-800/80 rounded-2xl flex gap-1">
            <button
              onClick={() => setActiveTab('online')}
              className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                activeTab === 'online'
                  ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/20 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>คนออนไลน์</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                {onlineMembers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-amber-600/30 to-orange-600/20 text-amber-300 shadow-sm border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline ประวัติ</span>
            </button>

            <button
              onClick={() => setActiveTab('boss')}
              className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                activeTab === 'boss'
                  ? 'bg-gradient-to-r from-amber-600/30 to-yellow-600/20 text-amber-300 shadow-sm border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>รหัสแก๊ง 7 วัน</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* TAB 1: ONLINE MEMBERS */}
          {activeTab === 'online' && (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400 flex items-center justify-between mb-2">
                <span>สมาชิกที่กำลังเปิดใช้งานแผนที่อยู่ตอนนี้:</span>
                <span className="text-emerald-400 font-mono text-[10px]">อัปเดตสดอัตโนมัติ</span>
              </div>

              {onlineMembers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  ยังไม่มีคนอื่นออนไลน์ในขณะนี้
                </div>
              ) : (
                onlineMembers.map((member) => {
                  const isSelf = member.memberName === currentSession?.memberName;
                  return (
                    <div
                      key={member.clientId}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        isSelf
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                            {member.isMaster ? '👑' : '👤'}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-100">{member.memberName}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                คุณ
                              </span>
                            )}
                            {member.isMaster && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-semibold border border-red-500/30">
                                หัวหน้า
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              {member.device === 'Mobile' ? (
                                <Smartphone className="w-3 h-3 text-slate-400" />
                              ) : (
                                <Monitor className="w-3 h-3 text-slate-400" />
                              )}
                              <span>{member.device}</span>
                            </span>
                            <span>•</span>
                            <span>เข้าเมื่อ {formatDuration(member.joinedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>กำลังดูแผนที่</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ACTIVITY LOGS (NameThatUI Pattern: Timeline) */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1 px-1">
                <span>ไทม์ไลน์กิจกรรมเรียลไทม์:</span>
                <span className="text-slate-500 text-[10px] font-mono">50 รายการล่าสุด</span>
              </div>

              {activityLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  ยังไม่มีประวัติกิจกรรมในขณะนี้
                </div>
              ) : (
                <div className="relative pl-6 pr-1 py-1 space-y-3.5">
                  {/* Vertical connecting rail line */}
                  <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-amber-500/50 via-slate-700/60 to-transparent"></div>

                  {activityLogs.map((log) => {
                    const getNodeConfig = () => {
                      switch (log.action) {
                        case 'login':
                          return { icon: '🟢', bg: 'bg-emerald-950 border-emerald-500', tag: 'LOGIN', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
                        case 'cooldown_start':
                          return { icon: '🔥', bg: 'bg-amber-950 border-amber-500', tag: 'COOLDOWN', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
                        case 'spot_add':
                          return { icon: '📍', bg: 'bg-sky-950 border-sky-500', tag: 'NEW PIN', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
                        case 'spot_update':
                          return { icon: '✏️', bg: 'bg-indigo-950 border-indigo-500', tag: 'UPDATE', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
                        case 'spot_delete':
                          return { icon: '🗑️', bg: 'bg-red-950 border-red-500', tag: 'DELETE', tagColor: 'text-red-400 bg-red-500/10 border-red-500/30' };
                        case 'spot_move':
                          return { icon: '🧭', bg: 'bg-purple-950 border-purple-500', tag: 'MOVE', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
                        default:
                          return { icon: '📋', bg: 'bg-slate-900 border-slate-700', tag: 'ACTION', tagColor: 'text-slate-300 bg-slate-800 border-slate-700' };
                      }
                    };
                    const config = getNodeConfig();

                    return (
                      <div key={log.id} className="relative flex items-start gap-3 group">
                        {/* Timeline Node */}
                        <div
                          className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 ${config.bg} flex items-center justify-center text-[10px] shadow-md z-10 transition-transform group-hover:scale-115`}
                        >
                          {config.icon}
                        </div>

                        {/* Timeline Card */}
                        <div className="flex-1 p-2.5 px-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 group-hover:border-slate-700/80 transition-all shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{log.memberName}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold border ${config.tagColor}`}>
                                {config.tag}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {formatTimeStr(log.timestamp)}
                            </span>
                          </div>
                          {log.details && (
                            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BOSS / DAILY PINS */}
          {activeTab === 'boss' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      ตารางรหัสผ่านประจำวัน (ล่วงหน้า 7 วัน)
                    </span>
                  </div>

                  <button
                    onClick={handleCopyDiscord}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกไปลง Discord'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  รหัสจะเปลี่ยนอัตโนมัติทุกวันเวลา 00:00 น. หัวหน้าสามารถกดปุ่มด้านบนเพื่อคัดลอกข้อความไปโพสต์ประกาศใน Discord แก๊งได้เลย
                </p>
              </div>

              <div className="space-y-1.5">
                {upcomingPins.map((item) => (
                  <div
                    key={item.dateStr}
                    className={`p-2.5 px-3 rounded-xl border flex items-center justify-between text-xs ${
                      item.isToday
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold shadow'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.dayName}</span>
                      {item.isToday && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 text-[10px] font-bold">
                          วันนี้
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black tracking-widest bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-white">
                        {item.pin}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => {
              logoutGang();
              onLogout();
            }}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบแผนที่</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
