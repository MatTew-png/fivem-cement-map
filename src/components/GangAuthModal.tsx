import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, User, KeyRound, AlertCircle, Sparkles, ShieldAlert, Timer } from 'lucide-react';
import { verifyPIN, AVAILABLE_BRANCHES, parseBranch, type BranchInfo } from '../utils/gangAuth';
import type { GangSession } from '../utils/gangAuth';
import { logIpAccess } from '../utils/ipLogger';

interface GangAuthModalProps {
  onSuccess: (session: GangSession) => void;
}

const FAILED_ATTEMPTS_KEY = 'runthukverb_pin_failed_attempts';
const LOCKOUT_KEY = 'runthukverb_pin_lockout_until';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

export const GangAuthModal: React.FC<GangAuthModalProps> = ({ onSuccess }) => {
  const [selectedBranch, setSelectedBranch] = useState<BranchInfo>(AVAILABLE_BRANCHES[0]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ระบบป้องกันสุ่มรหัสผ่าน (Lockout 10 นาทีเมื่อใส่ผิด 5 ครั้ง)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const saved = localStorage.getItem(FAILED_ATTEMPTS_KEY);
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    const saved = localStorage.getItem(LOCKOUT_KEY);
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [remainingSec, setRemainingSec] = useState<number>(0);

  // ตรวจสอบเวลานับถอยหลังการล็อค
  useEffect(() => {
    const checkLockout = () => {
      const now = Date.now();
      if (lockedUntil > now) {
        setRemainingSec(Math.ceil((lockedUntil - now) / 1000));
      } else {
        if (remainingSec > 0 || lockedUntil > 0) {
          setRemainingSec(0);
          setLockedUntil(0);
          setFailedAttempts(0);
          localStorage.removeItem(LOCKOUT_KEY);
          localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        }
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil, remainingSec]);

  // ล็อคสาขาเงียบๆ ตามลิงก์ที่ผู้ใช้กดเข้ามา (?gang=gang-1 หรือ ?branch=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const branchParam = urlParams.get('branch') || urlParams.get('gang');
      if (branchParam && branchParam.trim()) {
        const branch = parseBranch(branchParam.trim());
        setSelectedBranch(branch);
      } else {
        const savedBranch = localStorage.getItem('runthukverb_last_branch') || localStorage.getItem('runthukverb_last_gang_name');
        if (savedBranch && savedBranch.trim()) {
          setSelectedBranch(parseBranch(savedBranch.trim()));
        }
      }
    }

    const savedName = localStorage.getItem('runthukverb_last_member_name');
    if (savedName) setName(savedName);
  }, []);

  const formatRemainingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLocked = lockedUntil > Date.now();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isLocked) {
      setError(`ระบบถูกระงับชั่วคราวเนื่องจากใส่รหัสผิดครบ 5 ครั้ง กรุณารออีก ${formatRemainingTime(remainingSec)} นาที`);
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

    setTimeout(() => {
      const result = verifyPIN(pin, name, selectedBranch.id);
      setIsSubmitting(false);

      if (result.success && result.session) {
        // ล้างประวัติการใส่รหัสผิดเมื่อผ่านสำเร็จ
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
        setFailedAttempts(0);
        setLockedUntil(0);

        logIpAccess({
          action: 'login_success',
          memberName: name.trim(),
          isMaster: result.isMaster,
        });
        localStorage.setItem('runthukverb_last_member_name', name.trim());
        localStorage.setItem('runthukverb_last_branch', selectedBranch.id);
        localStorage.setItem('runthukverb_last_gang_name', selectedBranch.name);
        onSuccess(result.session);
      } else {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        localStorage.setItem(FAILED_ATTEMPTS_KEY, String(nextFails));

        logIpAccess({
          action: 'login_fail',
          memberName: name.trim(),
          attemptedPin: pin.trim(),
        });

        if (nextFails >= MAX_ATTEMPTS) {
          const lockoutTime = Date.now() + LOCKOUT_MS;
          setLockedUntil(lockoutTime);
          localStorage.setItem(LOCKOUT_KEY, String(lockoutTime));
          localStorage.removeItem(FAILED_ATTEMPTS_KEY);
          setFailedAttempts(0);
          setError(`🔒 คุณใส่รหัสผ่านผิดครบ 5 ครั้ง! ระบบระงับการเข้าใช้งานเป็นเวลา 10 นาทีเพื่อความปลอดภัย`);
        } else {
          const remainingAttempts = MAX_ATTEMPTS - nextFails;
          setError(`รหัสผ่านไม่ถูกต้อง (ผิดครั้งที่ ${nextFails}/${MAX_ATTEMPTS} — หากผิดอีก ${remainingAttempts} ครั้งจะถูกล็อค 10 นาที)`);
        }
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none -bottom-20 -right-20"></div>

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-white">
              <Lock className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
            <span>COOLDOWN MAP</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[320px]">
            ระบบความปลอดภัยเฉพาะสมาชิก กรุณาระบุชื่อเล่นและรหัสผ่านเพื่อเข้าใช้งาน
          </p>
        </div>

        {/* Lockout Warning Banner */}
        {isLocked && (
          <div className="mb-5 p-4 rounded-2xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex flex-col items-center text-center gap-2 animate-shake shadow-lg shadow-red-950/40">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm text-red-300">
              ระบบถูกระงับชั่วคราว (Security Lockout)
            </div>
            <p className="text-[11px] text-slate-300 max-w-[280px]">
              ใส่รหัสผ่านผิดติดต่อกันครบ 5 ครั้ง ระบบถูกล็อค 10 นาทีเพื่อป้องกันการสุ่มรหัส
            </p>
            <div className="flex items-center gap-2 text-base font-mono font-black text-amber-300 tracking-wider mt-1 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>ปลดล็อคใน: {formatRemainingTime(remainingSec)}</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && !isLocked && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Name Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>ชื่อเล่นของคุณ</span>
            </label>
            <input
              type="text"
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
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>รหัสผ่านประจำวัน (Daily PIN)</span>
              </label>
              <span className="text-[10px] text-slate-400">เปลี่ยนทุก 00:00 น.</span>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              disabled={isLocked || isSubmitting}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="รหัสผ่าน 6 หลัก"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm tracking-widest font-mono text-center font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLocked || isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>กำลังตรวจสอบ...</span>
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

        {/* Footer info */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            💡 ตรวจสอบรหัสผ่านประจำวันได้จากช่อง Discord ทางการ
          </p>
        </div>
      </div>
    </div>
  );
};
