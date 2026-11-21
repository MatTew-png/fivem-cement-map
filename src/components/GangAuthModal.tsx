import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, User, KeyRound, AlertCircle, Sparkles, ShieldAlert, Timer, Eye, EyeOff } from 'lucide-react';
import { verifyPIN, type GangSession } from '../utils/gangAuth';

interface GangAuthModalProps {
  onSuccess: (session: GangSession) => void;
}

export const GangAuthModal: React.FC<GangAuthModalProps> = ({ onSuccess }) => {
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('runthukverb_last_member_name') || '';
  });
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (remainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingSec]);

  const formatRemainingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLocked = remainingSec > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError(`ระบบถูกระงับชั่วคราว กรุณารออีก ${formatRemainingTime(remainingSec)}`);
      return;
    }

    if (!name.trim()) {
      setError('กรุณากรอกชื่อเล่นของคุณ');
      return;
    }

    if (!pin.trim()) {
      setError('กรุณากรอกรหัสผ่าน 6 หลัก');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyPIN(pin, name);
    setIsSubmitting(false);

    if (result.success && result.session) {
      setRemainingSec(0);
      localStorage.setItem('runthukverb_last_member_name', name.trim());
      if (result.session.isMaster) {
        localStorage.setItem('runthukverb_last_branch', result.session.gangId);
      }
      onSuccess(result.session);
      return;
    }

    if (result.retryAfterSec && result.retryAfterSec > 0) {
      setRemainingSec(result.retryAfterSec);
    }
    setError(result.error || 'รหัสผ่านประจำวันไม่ถูกต้อง');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="absolute w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none -bottom-20 -right-20"></div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 my-auto"
      >
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
              <Lock className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
            <span>COOLDOWN MAP</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[320px]">
            ยืนยันตัวตนผ่านเซิร์ฟเวอร์เฉพาะสมาชิกกลุ่ม ระบุชื่อเล่นและรหัสผ่านประจำวัน
          </p>
        </div>

        {isLocked && (
          <div className="mb-5 p-4 rounded-2xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex flex-col items-center text-center gap-2 animate-shake shadow-lg shadow-red-950/40">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-red-300">
              ระบบถูกระงับชั่วคราว (Security Lockout)
            </div>
            <p className="text-[11px] text-slate-300 max-w-[280px]">
              ใส่รหัสผ่านผิดติดต่อกันเกินกำหนด กรุณารอสักครู่
            </p>
            <div className="flex items-center gap-2 text-base font-mono font-black text-amber-300 tracking-wider mt-1 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>ปลดล็อคใน: {formatRemainingTime(remainingSec)}</span>
            </div>
          </div>
        )}

        {error && !isLocked && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Name Input */}
          <div>
            <label
              htmlFor="auth-member-name"
              className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>ชื่อเล่นของคุณ</span>
            </label>
            <input
              id="auth-member-name"
              type="text"
              autoComplete="nickname"
              disabled={isLocked || isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="กรอกชื่อเล่น..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Daily PIN Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-daily-pin"
                className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>รหัสผ่านประจำวัน</span>
              </label>
              <span className="text-[10px] text-slate-400">เปลี่ยนทุก 00:00 น.</span>
            </div>
            <div className="relative">
              <input
                id="auth-daily-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={16}
                disabled={isLocked || isSubmitting}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="รหัสผ่าน 6 หลัก"
                className="w-full px-11 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 tracking-widest font-mono text-center font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPin((prev) => !prev)}
                aria-label={showPin ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                title={showPin ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>กำลังตรวจสอบกับเซิร์ฟเวอร์...</span>
            ) : isLocked ? (
              <span>ระบบถูกล็อคชั่วคราว ({formatRemainingTime(remainingSec)})</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>เข้าสู่ระบบแผนที่</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            💡 ตรวจสอบรหัสผ่านประจำวันได้จากหัวหน้ากลุ่มหรือช่องทางนัดหมายของคุณ
          </p>
        </div>
      </div>
    </div>
  );
};
