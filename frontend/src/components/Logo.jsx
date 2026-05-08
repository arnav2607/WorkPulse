import React from "react";

export default function Logo({ size = 32, withText = true }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-lg bg-[#14532d] flex items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
          <path d="M3 12 L9 6 L12 9 L15 6 L21 12 L18 18 H6 Z" stroke="#fdba74" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="14" r="1.5" fill="#fdba74" />
        </svg>
      </div>
      {withText && (
        <div className="flex flex-col leading-tight">
          <span className="font-display font-semibold text-base tracking-tight">WorkPulse</span>
          <span className="text-[10px] uppercase tracking-widest text-stone-500">Operations</span>
        </div>
      )}
    </div>
  );
}
