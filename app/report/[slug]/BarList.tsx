'use client';

import * as React from 'react';
import { formatLabel, formatNumber } from './format';

export interface BarListItem {
  label: string;
  value: number;
  /** shown in the hover tooltip only, e.g. "1,204 users · 3.1% conv." */
  detail?: string;
}

interface BarListProps {
  items: BarListItem[];
  color: string;
  unit?: string;
}

// A single-hue horizontal bar list — the right encoding for comparing one
// metric across categories (no second dimension to justify per-bar color).
// Thin bars, rounded data-end, 2px surface gap between them, direct-labeled,
// with a hover tooltip carrying the supporting detail.
export function BarList({ items, color, unit }: BarListProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const pct = Math.max((item.value / max) * 100, 3);
        const isHovered = hovered === i;
        return (
          <div
            key={item.label}
            className="relative flex items-center gap-3"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-[112px] shrink-0 truncate text-xs text-[#94A3B8]">{formatLabel(item.label)}</div>
            <div className="relative h-2.5 flex-1 rounded-full bg-white/[0.05]">
              <div
                className="h-2.5 rounded-full transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <div className="w-16 shrink-0 text-right font-mono text-xs text-white tabular-nums">
              {formatNumber(item.value)}
              {unit ?? ''}
            </div>

            {isHovered && (
              <div
                className="pointer-events-none absolute left-[112px] top-full z-10 mt-1 whitespace-nowrap rounded-lg border border-white/10 bg-[#0D1526] px-2.5 py-1.5 text-xs text-white shadow-lg"
                role="tooltip"
              >
                <div className="font-semibold">{formatLabel(item.label)}</div>
                {item.detail && <div className="text-[#94A3B8]">{item.detail}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
