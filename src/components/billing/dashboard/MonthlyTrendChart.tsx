import { useState } from 'react';
import { formatCop, formatCopExact } from '../../../lib/utils';
import type { TrendMonth } from './types';

interface Props {
  data: TrendMonth[];
}

const WIDTH = 640;
const HEIGHT = 240;
const PADDING = { top: 28, right: 12, bottom: 28, left: 12 };

// Gráfico de barras agrupadas (esperado vs cobrado) en SVG puro. Esperado
// se dibuja como barra "contorno" (referencia/meta), cobrado como barra
// llena en el verde semántico ya usado para "pagado" en el resto de la app
// — un solo eje, sin librerías.
export function MonthlyTrendChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxValue = Math.max(1, ...data.flatMap((d) => [d.expected, d.collected]));
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const groupWidth = chartWidth / Math.max(1, data.length);
  const barWidth = Math.min(26, groupWidth * 0.28);
  const baseY = HEIGHT - PADDING.bottom;

  function scaleY(value: number): number {
    return (value / maxValue) * chartHeight;
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px solid var(--fg-muted)', display: 'inline-block' }} />
          Esperado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }} />
          Cobrado
        </span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Tendencia de ingresos esperados y cobrados de los últimos ${data.length} meses`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line x1={PADDING.left} y1={baseY} x2={WIDTH - PADDING.right} y2={baseY} stroke="var(--border)" strokeWidth={1} />

        {data.map((d, i) => {
          const groupX = PADDING.left + i * groupWidth;
          const centerX = groupX + groupWidth / 2;
          const gap = 4;
          const expectedX = centerX - barWidth - gap / 2;
          const collectedX = centerX + gap / 2;
          const expectedH = scaleY(d.expected);
          const collectedH = scaleY(d.collected);
          const isHovered = hovered === i;

          return (
            <g
              key={d.monthKey}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              style={{ cursor: 'pointer' }}
            >
              {/* Área de hit invisible que cubre todo el ancho del grupo —
                  el objetivo del hover es más grande que las barras mismas. */}
              <rect x={groupX} y={0} width={groupWidth} height={chartHeight + PADDING.top} fill="transparent" />
              {isHovered && (
                <rect x={groupX} y={0} width={groupWidth} height={chartHeight + PADDING.top} fill="var(--cyan)" opacity={0.06} />
              )}

              {d.expected > 0 && (
                <rect
                  x={expectedX}
                  y={baseY - expectedH}
                  width={barWidth}
                  height={Math.max(1, expectedH)}
                  rx={4}
                  fill="none"
                  stroke="var(--fg-muted)"
                  strokeWidth={1.5}
                />
              )}
              {d.collected > 0 && (
                <rect x={collectedX} y={baseY - collectedH} width={barWidth} height={Math.max(1, collectedH)} rx={4} fill="var(--success)" />
              )}
              {d.collected > 0 && (
                <text
                  x={collectedX + barWidth / 2}
                  y={baseY - collectedH - 6}
                  textAnchor="middle"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 'var(--fg-muted)' }}
                >
                  {formatCop(d.collected)}
                </text>
              )}

              <text
                x={centerX}
                y={baseY + 16}
                textAnchor="middle"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--fg-muted)' }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered != null && data[hovered] && (
        <div
          className="card-glass"
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${((hovered + 0.5) / data.length) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
            padding: '8px 12px',
            fontSize: '0.7rem',
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

      <p style={{ margin: '8px 0 0', fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
        Meses anteriores calculados con los fees actuales.
      </p>
    </div>
  );
}
