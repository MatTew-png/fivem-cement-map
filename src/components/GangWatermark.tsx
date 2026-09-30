import React from 'react';

interface GangWatermarkProps {
  memberName?: string;
  authDate?: string;
}

export const GangWatermark: React.FC<GangWatermarkProps> = ({ memberName, authDate }) => {
  if (!memberName) return null;

  const dateStr = authDate || new Date().toISOString().slice(0, 10);
  const stampText = `${memberName.toUpperCase()} • ${dateStr} • RUNTHUKVERB GANG CONFIDENTIAL`;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[850] overflow-hidden select-none flex flex-col justify-around opacity-[0.065] mix-blend-screen"
      aria-hidden="true"
    >
      {[...Array(6)].map((_, rowIdx) => (
        <div 
          key={rowIdx} 
          className="flex whitespace-nowrap transform -rotate-12 translate-x-[-10%] gap-12 font-mono text-[11px] font-bold text-slate-200 tracking-widest uppercase"
        >
          {[...Array(5)].map((__, colIdx) => (
            <span key={colIdx} className="drop-shadow-sm">
              🛡️ {stampText}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
