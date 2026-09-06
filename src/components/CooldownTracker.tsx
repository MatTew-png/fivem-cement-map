import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ActiveCooldown, CementSpot } from '../types/map';
import { soundEffects } from '../utils/sound';

interface CooldownTrackerProps {
  cooldowns: ActiveCooldown[];
  spots: CementSpot[];
  onCancelCooldown: (spotId: string) => void;
  onFocusSpot: (spot: CementSpot) => void;
}

export const CooldownTracker = ({
  cooldowns,
  spots,
  onCancelCooldown,
  onFocusSpot,
}: CooldownTrackerProps) => {
  const [now, setNow] = useState(Date.now());
  const [notifiedSpots, setNotifiedSpots] = useState<Set<string>>(new Set());

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for expired cooldowns and sound chime
  useEffect(() => {
    cooldowns.forEach((cd) => {
      if (cd.expiresAt <= now && !notifiedSpots.has(cd.spotId)) {
        setNotifiedSpots((prev) => new Set(prev).add(cd.spotId));
        soundEffects.playCooldownFinished();
        // Fire celebration confetti
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
          });
        } catch {
          // ignore
        }
      }
    });
  }, [now, cooldowns, notifiedSpots]);

  if (cooldowns.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-[1000] w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2 pointer-events-none">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
            <span>กำลังคูลดาวน์ ({cooldowns.length} จุด)</span>
          </div>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {cooldowns.map((cd) => {
            const spot = spots.find((s) => s.id === cd.spotId);
            if (!spot) return null;

            const remainingSeconds = Math.max(0, Math.floor((cd.expiresAt - now) / 1000));
            const totalSeconds = cd.durationSeconds;
            const progress = Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100));
            const isReady = remainingSeconds === 0;

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            return (
              <div
                key={cd.spotId}
                className={`p-2.5 rounded-xl border transition-all text-xs ${
                  isReady
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/70 border-slate-700/60 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    onClick={() => onFocusSpot(spot)}
                    className="font-medium truncate hover:text-amber-400 cursor-pointer flex-1 mr-2"
                    title={spot.name}
                  >
                    {spot.name}
                  </span>
                  <button
                    onClick={() => onCancelCooldown(cd.spotId)}
                    title="ยกเลิกการจับเวลา"
                    className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors"
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
                    <button
                      onClick={() => onFocusSpot(spot)}
                      className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] hover:bg-emerald-400 transition-colors"
                    >
                      ดูจุดนี้
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1 font-mono text-slate-400">
                      <span>เหลือเวลา</span>
                      <span className="font-bold text-amber-400">{timeStr}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-1000"
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
  );
};
