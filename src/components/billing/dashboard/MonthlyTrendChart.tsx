import { useState } from 'react';
import { formatCop, formatCopExact } from '../../../lib/utils';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import type { TrendMonth } from './types';

interface Props {
  data: TrendMonth[];
}

const WIDTH = 300;
const HEIGHT = 56;
const PAD_X = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;

function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

// Gráfica compacta tipo "bolsa de valores" (línea + área suave) para la
// tarjeta pequeña de tendencia — reemplaza las barras grandes de antes.
// SVG puro, sin librerías.
export function MonthlyTrendChart({ data }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  const isEmpty = data.length === 0 || data.every((d) => d.expected === 0 && d.collected === 0);

  if (isEmpty) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p className="number-label" style={{ fontSize: '0.6rem', color: 'var(--fg-muted)' }}>Tendencia de 6 meses</p>
        <p className="empty-note" style={{ margin: '8px 0' }}>Sin historial aún</p>
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.flatMap((d) => [d.expected, d.collected]));
  const chartWidth = WIDTH - PAD_X * 2;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  function point(value: number, index: number) {
    const x = PAD_X + stepX * index;
    const y = PAD_TOP + chartHeight * (1 - value / maxValue);
    return { x, y };
  }

  const collectedPoints = data.map((d, i) => point(d.collected, i));
  const expectedPoints = data.map((d, i) => point(d.expected, i));
  const collectedPath = buildPath(collectedPoints);
  const expectedPath = buildPath(expectedPoints);
  const areaPath = `${collectedPath} L${collectedPoints[collectedPoints.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${collectedPoints[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z`;

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const variation = prev && prev.collected > 0 ? ((last.collected - prev.collected) / prev.collected) * 100 : null;
  const variationColor = variation == null ? 'var(--fg-muted)' : variation >= 0 ? 'var(--success)' : 'var(--danger)';
  const variationText = variation == null ? '—' : `${variation >= 0 ? '▲' : '▼'} ${Math.abs(variation).toFixed(0)}%`;

  const gradientId = 'trend-area-gradient';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <p className="number-label" style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', margin: 0 }}>Tendencia de 6 meses</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.84rem', color: 'var(--fg)' }}>
            {formatCop(last.collected)}
          </span>
          <span style={{ fontSize: '0.6rem', color: variationColor, fontFamily: 'JetBrains Mono, monospace' }}>{variationText}</span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Tendencia de 6 meses: cobrado ${last.label} ${formatCopExact(last.collected)} de ${formatCopExact(last.expected)} esperado, variación ${variation == null ? 'sin datos del mes anterior' : `${variation.toFixed(0)} por ciento`} respecto al mes anterior`}
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={expectedPath} fill="none" stroke="var(--fg-muted)" strokeWidth={1.25} strokeDasharray="3 3" />
          <path
            d={collectedPath}
            fill="none"
            stroke="var(--success)"
            strokeWidth={1.75}
            style={{ transition: reducedMotion ? 'none' : 'd 400ms ease-out' }}
          />

          {collectedPoints.map((p, i) => (
            <rect
              key={data[i].monthKey}
              x={i === 0 ? 0 : p.x - stepX / 2}
              y={0}
              width={i === 0 || i === collectedPoints.length - 1 ? stepX / 2 + PAD_X : stepX}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
          ))}

          {hovered != null && (
            <line
              x1={collectedPoints[hovered].x}
              x2={collectedPoints[hovered].x}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="var(--border)"
              strokeWidth={1}
            />
          )}

          <circle
            cx={collectedPoints[collectedPoints.length - 1].x}
            cy={collectedPoints[collectedPoints.length - 1].y}
            r={2.6}
            fill="var(--success)"
          />
          {hovered != null && (
            <circle cx={collectedPoints[hovered].x} cy={collectedPoints[hovered].y} r={2.6} fill="var(--success)" />
          )}
        </svg>

        {hovered != null && (
          <div
            className="card-glass"
            role="tooltip"
            style={{
              position: 'absolute',
              left: `${(hovered / Math.max(1, data.length - 1)) * 100}%`,
              top: 0,
              transform: `translate(${hovered === 0 ? '0%' : hovered === data.length - 1 ? '-100%' : '-50%'}, -100%)`,
              padding: '6px 10px',
              fontSize: '0.64rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--fg)' }}>{data[hovered].label}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--fg-muted)' }}>Esperado: {formatCopExact(data[hovered].expected)}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--success)' }}>Cobrado: {formatCopExact(data[hovered].collected)}</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {data.map((d) => (
          <span key={d.monthKey} style={{ fontSize: '0.56rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {d.label}
          </span>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: '0.56rem', color: 'var(--fg-muted)' }}>Meses anteriores calculados con los fees actuales.</p>
    </div>
  );
}
