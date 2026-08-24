export const formatNumber = (n: number): string => new Intl.NumberFormat('en-US').format(Math.round(n));

export const formatPct = (n: number): string => `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;

export const formatChangePct = (n: number | null): string => {
  if (n === null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

export const formatShortDate = (d: Date | string): string =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatDateRange = (start: Date | string, end: Date | string): string =>
  `${formatShortDate(start)} – ${formatShortDate(end)}`;

// "sessionDefaultChannelGroup" style values already read fine, but some GA4
// event names are snake_case — make them readable in the UI.
export const formatLabel = (s: string): string =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
