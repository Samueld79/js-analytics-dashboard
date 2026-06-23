import { useMemo } from 'react';

interface Star {
  id:        number;
  top:       string;
  left:      string;
  size:      number;
  opacity:   number;
  duration:  number;
  delay:     number;
  isCyan:    boolean;
  isLarge:   boolean;
}

export function StarField() {
  const stars = useMemo<Star[]>(() => {
    const rng = (seed: number, max: number, min = 0) => {
      const x = Math.sin(seed) * 10000;
      return min + ((x - Math.floor(x)) * (max - min));
    };
    return Array.from({ length: 80 }, (_, i) => ({
      id:       i,
      top:      `${rng(i * 1.1, 100).toFixed(2)}%`,
      left:     `${rng(i * 1.7, 100).toFixed(2)}%`,
      size:     rng(i * 2.3, 3, 1),
      opacity:  rng(i * 3.1, 0.8, 0.2),
      duration: rng(i * 4.7, 7, 3),
      delay:    rng(i * 5.9, 6, 0),
      isCyan:   i % 5 === 0,
      isLarge:  i < 3,
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Nebula */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 600, height: 600,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, oklch(0.82 0.15 200 / 0.08) 0%, transparent 70%)',
        filter: 'blur(40px)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: s.isLarge ? `${s.size * 2}px` : `${s.size}px`,
            height: s.isLarge ? `${s.size * 2}px` : `${s.size}px`,
            borderRadius: '50%',
            background: s.isCyan ? 'var(--cyan)' : 'oklch(1 0 0)',
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            boxShadow: s.isLarge
              ? `0 0 ${s.size * 6}px ${s.size}px ${s.isCyan ? 'var(--cyan-dim)' : 'oklch(1 0 0 / 0.15)'}`
              : 'none',
          }}
        />
      ))}
    </div>
  );
}
