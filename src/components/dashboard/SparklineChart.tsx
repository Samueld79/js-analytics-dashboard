import { useId } from 'react';

interface SparklineChartProps {
  data:    number[];
  width?:  number;
  height?: number;
  color?:  string;
  filled?: boolean;
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const midX = ((p1.x + p2.x) / 2).toFixed(1);
    d += ` C ${midX},${p1.y.toFixed(1)} ${midX},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function SparklineChart({
  data,
  width  = 100,
  height = 44,
  color  = 'var(--cc-accent)',
  filled = true,
}: SparklineChartProps) {
  const uid = useId().replace(/:/g, '_');

  if (!data || data.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const uw = width  - pad * 2;
  const uh = height - pad * 2;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * uw + pad,
    y: uh - ((v - min) / range) * uh + pad,
  }));

  const linePath = buildSmoothPath(pts);

  const areaPath = linePath
    + ` L ${pts[pts.length - 1].x.toFixed(1)},${(uh + pad).toFixed(1)}`
    + ` L ${pts[0].x.toFixed(1)},${(uh + pad).toFixed(1)} Z`;

  const gradId = `sk-grad-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sparkline"
    >
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
