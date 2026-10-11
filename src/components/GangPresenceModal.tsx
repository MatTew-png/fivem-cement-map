import React, { useState, useEffect } from 'react';
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
  Trash2,
  ShieldAlert,
  Download,
  Bell,
  Search,
} from 'lucide-react';
import { gangPresence, type OnlineMember } from '../utils/presence';
import type { ActivityLog, GangSession } from '../utils/gangAuth';
import { getUpcomingPINs, formatPINsForDiscord, logoutGang } from '../utils/gangAuth';
import {
  getIpLogs,
  clearIpLogs,
  getBannedIps,
  banIp,
  unbanIp,
  getDiscordWebhookUrl,
  setDiscordWebhookUrl,
  type IpLogEntry,
} from '../utils/ipLogger';

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
  const [activeTab, setActiveTab] = useState<'online' | 'logs' | 'boss' | 'ip_logs'>('online');
  const [copied, setCopied] = useState(false);
  const [ipLogs, setIpLogs] = useState<IpLogEntry[]>(() => getIpLogs());
  const [bannedIps, setBannedIps] = useState<string[]>(() => getBannedIps());
  const [searchIpText, setSearchIpText] = useState('');
  const [webhookInput, setWebhookInput] = useState(() => getDiscordWebhookUrl());
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [webhookSavedSuccess, setWebhookSavedSuccess] = useState(false);

  useEffect(() => {
    if (activeTab === 'ip_logs') {
      setIpLogs(getIpLogs());
      setBannedIps(getBannedIps());
    }
  }, [activeTab]);

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

  const handleBan = (ip: string) => {
    banIp(ip);
    setBannedIps(getBannedIps());
    setIpLogs(getIpLogs());
  };

  const handleUnban = (ip: string) => {
    unbanIp(ip);
    setBannedIps(getBannedIps());
    setIpLogs(getIpLogs());
  };

  const handleClearIpLogs = () => {
    if (confirm('คุณต้องการลบประวัติ IP ทั้งหมดใช่หรือไม่?')) {
      clearIpLogs();
      setIpLogs([]);
    }
  };

  const handleSaveWebhook = () => {
    setDiscordWebhookUrl(webhookInput);
    setWebhookSavedSuccess(true);
    setTimeout(() => setWebhookSavedSuccess(false), 2500);
  };

  const handleExportCsv = () => {
    const logs = getIpLogs();
    if (logs.length === 0) {
      alert('ไม่มีประวัติ Log สำหรับส่งออก');
      return;
    }
    const headers = ['เวลา', 'IP Address', 'จังหวัด/ประเทศ', 'ผู้ให้บริการ(ISP)', 'อุปกรณ์', 'การกระทำ', 'ชื่อที่กรอก', 'รหัสที่พยายามใส่'];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toLocaleString('th-TH'),
      l.ip,
      `${l.city || ''} ${l.country || ''}`.trim(),
      l.isp || '',
      l.device,
      l.action === 'login_success' ? 'สำเร็จ' : l.action === 'login_fail' ? 'รหัสผิด' : l.action === 'banned_blocked' ? 'ถูกบล็อก' : 'เข้าชมเว็บ',
      l.memberName || '',
      l.attemptedPin || '',
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runthukverb_ip_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

            {currentSession?.isMaster && (
              <button
                onClick={() => setActiveTab('ip_logs')}
                className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                  activeTab === 'ip_logs'
                    ? 'bg-gradient-to-r from-red-600/30 to-rose-600/20 text-red-300 shadow-sm border border-red-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>บันทึก IP</span>
                {ipLogs.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 text-[10px] font-mono">
                    {ipLogs.length}
                  </span>
                )}
              </button>
            )}
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
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] font-mono">{activityLogs.length} รายการ</span>
                  {activityLogs.length > 0 && (
                    <button
                      onClick={() => gangPresence.clearLogs()}
                      className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 text-[10px] border border-slate-700/60 hover:border-red-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                      title="ล้างประวัติกิจกรรมทั้งหมด"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>ล้างประวัติ</span>
                    </button>
                  )}
                </div>
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
                        case 'cooldown_cancel':
                          return { icon: '⏹️', bg: 'bg-rose-950 border-rose-500', tag: 'CANCELLED', tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
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

          {/* TAB 4: IP ACCESS LOGS & SECURITY VAULT */}
          {activeTab === 'ip_logs' && currentSession?.isMaster && (
            <div className="space-y-3">
              {/* Top Stats & Actions Bar */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span>บันทึกประวัติ IP</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {ipLogs.length} รายการ
                  </span>
                  {bannedIps.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] text-red-300 font-bold">
                      แบนอยู่ {bannedIps.length} IP
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                      showWebhookConfig
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 hover:bg-slate-850 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>แจ้งเตือน Discord</span>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    title="ดาวน์โหลดประวัติเป็นไฟล์ CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  {ipLogs.length > 0 && (
                    <button
                      onClick={handleClearIpLogs}
                      className="px-2 py-1 rounded-xl text-[11px] font-bold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 flex items-center gap-1 cursor-pointer transition-colors"
                      title="ล้างประวัติ Log ทั้งหมด"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Discord Webhook Settings Card (Expandable) */}
              {showWebhookConfig && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-indigo-400" />
                      <span>ตั้งค่าแจ้งเตือน IP เข้าเว็บลง Discord สดๆ</span>
                    </span>
                    {webhookSavedSuccess && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 animate-pulse">
                        บันทึกสำเร็จ!
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    นำ Webhook URL จากห้อง Discord ของคุณมาวาง เพื่อให้ระบบส่งแจ้งเตือน IP ทุกครั้งที่มีคนเปิดเว็บ หรือพิมพ์รหัสผิด ส่งตรงเข้ามือถือทันที
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={webhookInput}
                      onChange={(e) => setWebhookInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={handleSaveWebhook}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      บันทึก
                    </button>
                  </div>
                </div>
              )}

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาตาม IP, ชื่อเล่น, หรือจังหวัด..."
                  value={searchIpText}
                  onChange={(e) => setSearchIpText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>

              {/* Log Entries List */}
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {(() => {
                  const query = searchIpText.toLowerCase().trim();
                  const filtered = ipLogs.filter((log) => {
                    if (!query) return true;
                    return (
                      log.ip.toLowerCase().includes(query) ||
                      (log.memberName && log.memberName.toLowerCase().includes(query)) ||
                      (log.city && log.city.toLowerCase().includes(query)) ||
                      (log.isp && log.isp.toLowerCase().includes(query)) ||
                      (log.attemptedPin && log.attemptedPin.includes(query))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 text-xs">
                        {searchIpText ? 'ไม่พบข้อมูล IP ที่ตรงกับการค้นหา' : 'ยังไม่มีบันทึกประวัติการเข้าใช้งาน'}
                      </div>
                    );
                  }

                  return filtered.map((item) => {
                    const isBanned = bannedIps.includes(item.ip);
                    const isFail = item.action === 'login_fail';
                    const isSuccess = item.action === 'login_success';
                    const isBlocked = item.action === 'banned_blocked';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all text-xs ${
                          isBanned || isBlocked
                            ? 'bg-red-950/20 border-red-900/60'
                            : isFail
                            ? 'bg-rose-950/15 border-rose-800/40'
                            : isSuccess
                            ? 'bg-emerald-950/15 border-emerald-800/40'
                            : 'bg-slate-950/40 border-slate-850'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            {/* Status Pill */}
                            {isSuccess && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                                <span>🟢 สำเร็จ</span>
                                {item.isMaster && <span>👑</span>}
                              </span>
                            )}
                            {isFail && (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/25 border border-red-500/50 text-red-300 font-bold text-[10px] flex items-center gap-1 animate-pulse">
                                <span>🚨 รหัสผิด!</span>
                              </span>
                            )}
                            {isBlocked && (
                              <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400 font-bold text-[10px]">
                                ⛔ บล็อกแล้ว
                              </span>
                            )}
                            {item.action === 'visit' && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px]">
                                🌐 เข้าชมเว็บ
                              </span>
                            )}

                            {/* IP Address */}
                            <span className="font-mono font-bold text-white text-xs select-all">
                              {item.ip}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {formatTimeStr(item.timestamp)}
                            </span>

                            {/* Ban / Unban Button */}
                            {item.ip && item.ip !== 'Unknown' && (
                              <button
                                onClick={() => (isBanned ? handleUnban(item.ip) : handleBan(item.ip))}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                  isBanned
                                    ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-600/50'
                                    : 'bg-red-950/50 hover:bg-red-900 text-red-300 border-red-800/50'
                                }`}
                              >
                                {isBanned ? '✅ ปลดแบน' : '🚫 แบน IP'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          {item.memberName && (
                            <span className="text-slate-200">
                              ชื่อ: <strong className="text-amber-300">{item.memberName}</strong>
                            </span>
                          )}
                          {item.attemptedPin && (
                            <span className="text-red-300 font-mono">
                              รหัสที่ใส่: <strong className="bg-red-950/60 px-1 rounded border border-red-800/40">{item.attemptedPin}</strong>
                            </span>
                          )}
                          {(item.city || item.isp) && (
                            <span className="text-slate-400">
                              📍 {item.city || ''} {item.isp ? `(${item.isp})` : ''}
                            </span>
                          )}
                          <span className="text-slate-500">
                            📱 {item.device}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
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
