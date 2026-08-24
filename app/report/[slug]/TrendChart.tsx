'use client';

import * as React from 'react';
import { formatNumber, formatShortDate } from './format';

export interface TrendPoint {
  periodEnd: string; // ISO date
  sessions: number;
  users: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  color: string; // sessions line — the client's brand color
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const USERS_COLOR = '#94A3B8'; // neutral — distinguishable from any brand hue by value alone, plus dash + legend

// Sessions & users over time — two series sharing one axis (never dual-axis).
// Solid brand-colored line for sessions, dashed neutral line for users, so
// identity never depends on color alone. Hover shows a crosshair + tooltip
// with the exact values, per point.
export function TrendChart({ points, color }: TrendChartProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  if (points.length === 0) return null;

  const maxVal = Math.max(...points.map((p) => Math.max(p.sessions, p.users)), 1);
  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  const x = (i: number) => PAD_L + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD_T + innerH - (v / maxVal) * innerH;

  const linePath = (key: 'sessions' | 'users') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - svgX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  };

  const gridLines = 3;
  const first = points[0];
  const last = points[points.length - 1];
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: 'auto' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Sessions and users trend over time"
      >
        {/* recessive gridlines */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          return <line key={i} x1={PAD_L} x2={WIDTH - PAD_R} y1={gy} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
        })}

        {/* users — dashed neutral line */}
        <path d={linePath('users')} fill="none" stroke={USERS_COLOR} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
        {/* sessions — solid brand line, drawn on top */}
        <path d={linePath('sessions')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />

        {/* selective direct labels — first and last point only */}
        <text x={x(0)} y={y(first.sessions) - 8} fontSize={10} fill={color} textAnchor="start">
          {formatNumber(first.sessions)}
        </text>
        <text x={x(points.length - 1)} y={y(last.sessions) - 8} fontSize={10} fill={color} textAnchor="end">
          {formatNumber(last.sessions)}
        </text>

        {/* crosshair */}
        {hoverIdx !== null && (
          <>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].sessions)} r={3.5} fill={color} stroke="#080D1A" strokeWidth={1.5} />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].users)} r={3.5} fill={USERS_COLOR} stroke="#080D1A" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {hovered && hoverIdx !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0D1526] px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hoverIdx) / WIDTH) * 100}%` }}
          role="tooltip"
        >
          <div className="mb-1 font-semibold text-white">{formatShortDate(hovered.periodEnd)}</div>
          <div className="flex items-center gap-1.5 text-[#CBD5E1]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            Sessions: {formatNumber(hovered.sessions)}
          </div>
          <div className="flex items-center gap-1.5 text-[#CBD5E1]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: USERS_COLOR }} />
            Users: {formatNumber(hovered.users)}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-[#94A3B8]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
          Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: USERS_COLOR, backgroundImage: `repeating-linear-gradient(90deg, ${USERS_COLOR} 0 3px, transparent 3px 6px)` }}
          />
          Users
        </span>
      </div>
    </div>
  );
}
