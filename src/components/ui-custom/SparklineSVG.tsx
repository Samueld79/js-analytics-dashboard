import { useId } from 'react';

interface SparklineSVGProps {
  data:     number[];
  color?:   string;
  height?:  number;
  width?:   number;
  filled?:  boolean;
}

function buildBezierPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const cx = ((p1.x + p2.x) / 2).toFixed(1);
    d += ` C ${cx},${p1.y.toFixed(1)} ${cx},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function SparklineSVG({
  data,
  color  = 'var(--cyan)',
  height = 44,
  width  = 100,
  filled = true,
}: SparklineSVGProps) {
  const uid = useId().replace(/:/g, '_');

  if (!data || data.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const uw = width  - pad * 2;
  const uh = height - pad * 2;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * uw + pad,
    y: uh - ((v - min) / range) * uh + pad,
  }));

  const linePath = buildBezierPath(pts);
  const last  = pts[pts.length - 1];
  const first = pts[0];

  const areaPath = filled
    ? linePath
      + ` L ${last.x.toFixed(1)},${(uh + pad).toFixed(1)}`
      + ` L ${first.x.toFixed(1)},${(uh + pad).toFixed(1)} Z`
    : '';

  const gradId = `sg-grad-${uid}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sparkline"
      style={{ overflow: 'visible' }}
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
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot at end */}
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
      <circle cx={last.x} cy={last.y} r={6} fill={color} opacity={0.25} />
    </svg>
  );
}
