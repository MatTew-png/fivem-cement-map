import React from 'react';

interface GtaCrosshairProps {
  visible: boolean;
}

export const GtaCrosshair: React.FC<GtaCrosshairProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[900]">
      {/* Horizontal line */}
      <div className="gta-crosshair-h" />
      {/* Vertical line */}
      <div className="gta-crosshair-v" />
      {/* Subtle tick marks around center */}
      <div className="gta-crosshair-center flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
      </div>
    </div>
  );
};
