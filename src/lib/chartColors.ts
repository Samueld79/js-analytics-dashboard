/**
 * Shared chart palette for Agency OS
 * Single source of truth for all Recharts components.
 */
export const CHART = {
  cyan:   '#00e5ff',
  violet: '#7c3aed',
  green:  '#00e676',
  orange: '#ff6d00',
  amber:  '#ffab40',
  grid:   'rgba(255,255,255,0.06)',
  axis:   'rgba(255,255,255,0.4)',
} as const;

/** Ordered palette for multi-series charts */
export const CHART_PALETTE = [
  CHART.cyan,
  CHART.violet,
  CHART.green,
  CHART.orange,
  CHART.amber,
];

/** Standard tooltip contentStyle for all charts */
export const TOOLTIP_STYLE = {
  background: 'rgba(15,15,25,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
};
