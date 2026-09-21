import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, User, KeyRound, AlertCircle, Sparkles, Crown } from 'lucide-react';
import { verifyPIN, DEFAULT_MASTER_PIN } from '../utils/gangAuth';
import type { GangSession } from '../utils/gangAuth';

interface GangAuthModalProps {
  onSuccess: (session: GangSession) => void;
}

export const GangAuthModal: React.FC<GangAuthModalProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBossHint, setShowBossHint] = useState(false);

  // โหลดชื่อเดิมที่เคยกรอกไว้เพื่อความสะดวก
  useEffect(() => {
    const savedName = localStorage.getItem('runthukverb_last_member_name');
    if (savedName) setName(savedName);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('กรุณากรอกชื่อเล่นหรือเลขประจำตัวในแก๊ง');
      return;
    }

    if (!pin.trim()) {
      setError('กรุณากรอกรหัสผ่าน 6 หลัก');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const result = verifyPIN(pin, name);
      setIsSubmitting(false);

      if (result.success) {
        localStorage.setItem('runthukverb_last_member_name', name.trim());
        // Create session object
        const session: GangSession = {
          memberName: name.trim(),
          authDate: new Date().toISOString().slice(0, 10),
          authenticatedAt: Date.now(),
          isMaster: result.isMaster,
        };
        onSuccess(session);
      } else {
        setError(result.error || 'รหัสผ่านไม่ถูกต้อง');
      }
    }, 250);
  };

  const handleFillMasterPin = () => {
    setPin(DEFAULT_MASTER_PIN);
    if (!name.trim()) {
      setName('[01] หัวหน้าแก๊ง');
    }
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
            <span>รันทุกเวิบ COOLDOWN</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-[300px]">
            ระบบรักษาความปลอดภัยเฉพาะคนในแก๊ง กรุณายืนยันตัวตนเพื่อปลดล็อคแผนที่
          </p>
        </div>

        {/* Error Alert */}
        {error && (
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
              <span>ชื่อเล่น หรือ เลขประจำตัวในแก๊ง</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ตัวอย่าง: [01] หัวหน้าทิว หรือ บอย"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium"
              autoFocus
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
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="กรอกรหัส 6 หลักจาก Discord แก๊ง"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm tracking-widest font-mono text-center font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-base"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>กำลังตรวจสอบ...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>เข้าสู่แผนที่แก๊ง</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info / Boss options */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 mb-2">
            💡 ตรวจสอบรหัสผ่านของวันนี้ได้ในช่อง Discord ทางการของแก๊ง
          </p>

          <button
            type="button"
            onClick={() => setShowBossHint(!showBossHint)}
            className="text-[11px] text-amber-400/80 hover:text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Crown className="w-3 h-3 text-amber-400" />
            <span>หัวหน้าแก๊ง (Boss Quick Login)</span>
          </button>

          {showBossHint && (
            <div className="mt-3 p-3 rounded-xl bg-slate-800/60 border border-amber-500/30 text-left animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="font-semibold text-amber-400">Master PIN ของหัวหน้า:</span>
                <button
                  type="button"
                  onClick={handleFillMasterPin}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40"
                >
                  กดเพื่อกรอก {DEFAULT_MASTER_PIN}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                รหัส Master สามารถเข้าได้ทุกวัน และมีสิทธิ์เปิดดูตารางรหัสล่วงหน้า 7 วัน
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
