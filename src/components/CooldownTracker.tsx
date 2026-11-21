import { useEffect, useState, useMemo, useRef, memo } from 'react';
import { Clock, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ActiveCooldown, CementSpot } from '../types/map';
import { soundEffects } from '../utils/sound';

interface CooldownTrackerProps {
  cooldowns: ActiveCooldown[];
  spots: CementSpot[];
  onCancelCooldown: (spotId: string) => void;
  onFocusSpot: (spot: CementSpot) => void;
  isDistanceOpen?: boolean;
}

export const CooldownTracker = memo(({
  cooldowns,
  spots,
  onCancelCooldown,
  onFocusSpot,
  isDistanceOpen = false,
}: CooldownTrackerProps) => {
  const [now, setNow] = useState(() => Date.now());
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const [isMinimized, setIsMinimized] = useState(false);

  const sortedCooldowns = useMemo(() => {
    return [...cooldowns].sort((a, b) => a.expiresAt - b.expiresAt);
  }, [cooldowns]);

  useEffect(() => {
    if (cooldowns.length === 0) {
      notifiedKeysRef.current.clear();
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldowns.length]);

  useEffect(() => {
    const activeKeys = new Set(cooldowns.map((cd) => `${cd.spotId}:${cd.expiresAt}`));
    for (const key of Array.from(notifiedKeysRef.current)) {
      if (!activeKeys.has(key)) {
        notifiedKeysRef.current.delete(key);
      }
    }

    cooldowns.forEach((cd) => {
      const key = `${cd.spotId}:${cd.expiresAt}`;
      if (cd.expiresAt <= now && !notifiedKeysRef.current.has(key)) {
        notifiedKeysRef.current.add(key);
        soundEffects.playCooldownFinished();
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
          });
        } catch {
          // ignore confetti errors in headless browsers
        }
      }
    });
  }, [now, cooldowns]);

  if (cooldowns.length === 0) return null;

  const positionClass = isDistanceOpen
    ? 'hidden sm:flex top-20 sm:right-[22.5rem]'
    : 'flex top-20 right-4';

  const topCd = sortedCooldowns[0];
  const topSpot = topCd ? spots.find((s) => s.id === topCd.spotId) : undefined;
  const topRemSec = topCd ? Math.max(0, Math.floor((topCd.expiresAt - now) / 1000)) : 0;
  const topMin = Math.floor(topRemSec / 60);
  const topSec = topRemSec % 60;
  const topTimeStr = `${topMin}:${topSec.toString().padStart(2, '0')}`;

  const mobileGpsPill = isDistanceOpen && topCd ? (
    <div className="sm:hidden fixed bottom-16 right-4 z-[850] pointer-events-none">
      <button
        type="button"
        onClick={() => topSpot && onFocusSpot(topSpot)}
        className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border font-mono font-bold text-xs shadow-xl cursor-pointer transition-all active:scale-95 ${
          topRemSec === 0
            ? 'bg-emerald-950/95 border-emerald-400 text-emerald-300'
            : topRemSec <= 180
            ? 'bg-red-950/95 border-red-500 text-red-200 animate-pulse'
            : 'bg-slate-900/95 border-amber-500/60 text-amber-300'
        }`}
        title="คลิกเพื่อดูจุดที่ใกล้เกิดที่สุด"
      >
        <Clock className="w-3.5 h-3.5" />
        <span className="max-w-[110px] truncate font-sans">
          {topSpot?.name || topCd.spotName || 'จุดปูน'}
        </span>
        <span>{topRemSec === 0 ? 'เกิดแล้ว!' : topTimeStr}</span>
        {cooldowns.length > 1 && (
          <span className="px-1 rounded bg-slate-800 text-[10px] text-slate-300">
            +{cooldowns.length - 1}
          </span>
        )}
      </button>
    </div>
  ) : null;

  if (isMinimized) {
    return (
      <>
        {mobileGpsPill}
        <div className={`absolute ${positionClass} z-[850] flex-col gap-2 pointer-events-none transition-all duration-200`}>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md border border-amber-500/50 text-amber-300 hover:text-white hover:border-amber-400 font-mono font-bold text-xs shadow-xl transition-all active:scale-95 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>คูลดาวน์ ({cooldowns.length})</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {mobileGpsPill}
      <div className={`absolute ${positionClass} z-[850] w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none transition-all duration-200`}>
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
            <span>กำลังคูลดาวน์ ({cooldowns.length} จุด)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="ย่อแถบติดตามคูลดาวน์"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="ย่อแถบนี้"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {sortedCooldowns.map((cd) => {
            const spot = spots.find((s) => s.id === cd.spotId);
            const displayName = spot?.name || cd.spotName || 'จุดปูน';

            const remainingSeconds = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
            const totalSeconds = Math.max(1, cd.durationSeconds);
            const progress = Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100));
            const isReady = remainingSeconds === 0;
            const isUrgent = remainingSeconds > 0 && remainingSeconds <= 180;

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            return (
              <div
                key={cd.spotId}
                className={`p-2.5 rounded-xl border transition-all text-xs ${
                  isReady
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : isUrgent
                    ? 'bg-red-950/60 border-red-500 shadow-lg shadow-red-500/30 text-white animate-pulse'
                    : 'bg-slate-800/70 border-slate-700/60 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  {spot ? (
                    <button
                      type="button"
                      onClick={() => onFocusSpot(spot)}
                      className="font-medium truncate hover:text-amber-400 cursor-pointer flex-1 text-left flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 rounded"
                      title={displayName}
                    >
                      {isUrgent && <span aria-hidden="true">🔥</span>}
                      <span className="truncate">{displayName}</span>
                    </button>
                  ) : (
                    <span className="font-medium truncate flex-1 flex items-center gap-1" title={displayName}>
                      {isUrgent && <span aria-hidden="true">🔥</span>}
                      <span className="truncate">{displayName}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onCancelCooldown(cd.spotId)}
                    title="ยกเลิกการจับเวลา"
                    aria-label={`ยกเลิกการจับเวลา ${displayName}`}
                    className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isReady ? (
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-emerald-500/30">
                    <span className="flex items-center gap-1 font-bold text-emerald-400 animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ปูนเกิดแล้ว! จกได้เลย
                    </span>
                    {spot && (
                      <button
                        type="button"
                        onClick={() => onFocusSpot(spot)}
                        className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] hover:bg-emerald-400 transition-colors cursor-pointer"
                      >
                        ดูจุดนี้
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1 font-mono gap-1">
                      <span className={`truncate ${isUrgent ? 'text-yellow-300 font-bold flex items-center gap-1' : 'text-slate-400'}`}>
                        {isUrgent ? '🔥 ใกล้เกิด!' : 'เหลือเวลา'}
                        {cd.startedBy && (
                          <span className="text-[10px] text-slate-400 font-sans ml-1">
                            • โดย {cd.startedBy}
                          </span>
                        )}
                      </span>
                      <span className={`font-bold shrink-0 ${isUrgent ? 'text-white text-xs font-black' : 'text-amber-400'}`}>
                        {timeStr}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          isUrgent
                            ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500'
                            : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
});
