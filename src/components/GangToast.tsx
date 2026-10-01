import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { GangNotification } from '../utils/presence';

interface GangToastProps {
  notifications: GangNotification[];
  onDismiss: (id: string) => void;
}

export const GangToast: React.FC<GangToastProps> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-[9995] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
      {notifications.map((notif) => (
        <ToastItem key={notif.id} notif={notif} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  notif: GangNotification;
  onDismiss: (id: string) => void;
}> = ({ notif, onDismiss }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [progressWidth, setProgressWidth] = useState('100%');

  useEffect(() => {
    // NameThatUI Pattern: Progress indicator for auto-dismissing Toast
    const animTimer = setTimeout(() => {
      setProgressWidth('0%');
    }, 50);

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(notif.id), 300);
    }, 4500);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(timer);
    };
  }, [notif.id, onDismiss]);

  const handleManualClose = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(notif.id), 300);
  };

  const getBorderColor = () => {
    switch (notif.type) {
      case 'member_join':
        return 'border-emerald-500/50 shadow-emerald-500/10';
      case 'cooldown_start':
        return 'border-amber-500/50 shadow-amber-500/10';
      case 'spot_add':
        return 'border-sky-500/50 shadow-sky-500/10';
      case 'spot_delete':
        return 'border-red-500/50 shadow-red-500/10';
      default:
        return 'border-slate-700/80 shadow-slate-900/50';
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border ${getBorderColor()} shadow-xl transition-all duration-300 ${
        isLeaving
          ? 'opacity-0 translate-y--2 scale-95'
          : 'animate-in fade-in slide-in-from-top-3 duration-300'
      }`}
    >
      {/* NameThatUI Pattern: Progress Bar Countdown */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800/80 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 transition-all duration-[4450ms] ease-linear"
          style={{ width: progressWidth }}
        />
      </div>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-lg shrink-0 select-none shadow-inner">
          {notif.icon || '🔔'}
        </div>

        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-100 truncate tracking-wide">
            {notif.title}
          </h4>
          {notif.subtitle && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {notif.subtitle}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleManualClose}
        className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
        title="ปิดการแจ้งเตือน"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
