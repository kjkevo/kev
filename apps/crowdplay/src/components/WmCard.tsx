"use client";

import { Icon } from "@/components/Icon";
import { WM_BORDER, WM_SYMBOL, WM_TEXT, type WmColor } from "@/lib/wildMatch";

export type WmCardSize = "sm" | "mid" | "md" | "lg";

const DIMS: Record<WmCardSize, { box: string; label: string; long: string; icon: number }> = {
  lg: { box: "w-24 h-36", label: "text-6xl", long: "text-2xl", icon: 22 },
  md: { box: "w-16 h-24", label: "text-4xl", long: "text-base", icon: 16 },
  mid: { box: "w-14 h-20", label: "text-3xl", long: "text-sm", icon: 14 },
  sm: { box: "w-10 h-14", label: "text-base", long: "text-[9px]", icon: 10 },
};

/**
 * A Wild Match card: a dark card with a colored edge and its color's own
 * symbol (Pink star, Purple crown, Teal bolt, Orange flame). "Pick" cards
 * (choose the color) are silver.
 */
export function WmCardFace({ color, label, size = "md" }: { color: WmColor | null; label: string; size?: WmCardSize }) {
  const d = DIMS[size];
  const long = label.length > 2;
  if (!color) {
    return (
      <span className={`${d.box} relative shrink-0 rounded-xl border-4 border-white bg-gradient-to-b from-slate-100 to-slate-400 text-slate-900 font-black flex items-center justify-center shadow-lg`}>
        <span className="absolute left-1 top-1"><Icon name="wand" size={d.icon} /></span>
        <span className={`leading-none text-center ${long ? d.long : d.label}`}>{label}</span>
      </span>
    );
  }
  return (
    <span className={`${d.box} relative shrink-0 rounded-xl border-4 ${WM_BORDER[color]} bg-slate-900 font-black flex items-center justify-center shadow-lg ${WM_TEXT[color]}`}>
      <span className="absolute left-1 top-1"><Icon name={WM_SYMBOL[color]} size={d.icon} /></span>
      <span className="absolute right-1 bottom-1 rotate-180"><Icon name={WM_SYMBOL[color]} size={d.icon} /></span>
      <span className={`leading-none text-center ${long ? d.long : d.label}`}>{label}</span>
    </span>
  );
}
