import { useEffect, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

interface Props {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label: string;
}

// Anillo de progreso en SVG puro (sin librerías). Anima el trazo al montar
// salvo que el usuario prefiera menos movimiento.
export function ProgressRing({ percent, size = 128, strokeWidth = 12, label }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const reducedMotion = usePrefersReducedMotion();
  const [animated, setAnimated] = useState(reducedMotion ? clamped : 0);

  useEffect(() => {
    // El propio valor no es la animación — eso lo hace el transition de la
    // CSS de abajo, que ya se desactiva con reducedMotion. Aquí solo
    // reaccionamos a cambios en rAF para evitar un setState síncrono en el
    // cuerpo del efecto.
    const raf = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--success)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: reducedMotion ? 'none' : 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: size * 0.2, fill: 'var(--fg)' }}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}
