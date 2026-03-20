import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type Dust = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  r: number;
  hueOffset: number;
  opacity: number;
};

function makeDust(w: number, h: number): Dust {
  const baseVy = -(Math.random() * 0.25 + 0.15); // -0.15 to -0.40
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.2, // -0.1 to 0.1
    vy: baseVy,
    baseVy,
    r: Math.random() * 2 + 1, // 1–3 px
    hueOffset: Math.random() * 100, // spread particles across hue space
    opacity: Math.random() * 0.3 + 0.2, // 0.20–0.50
  };
}

type StardustCanvasProps = {
  style?: CSSProperties;
};

export function StardustCanvas({ style }: StardustCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles: Dust[] = Array.from({ length: 120 }, () => makeDust(w, h));
    let t = 0;
    let rafId: number;

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 1;

      // Base hue oscillates 180 (cyan) ↔ 280 (purple) with period ~104s at 60fps
      const baseHue = 230 - 50 * Math.cos(t * 0.001);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of particles) {
        // Mouse repulsion — very soft
        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.hypot(dx, dy);
        if (d < 100 && d > 0) {
          const f = (1 - d / 100) * 0.03;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        } else {
          // Gently restore natural upward drift
          p.vy += (p.baseVy - p.vy) * 0.04;
          p.vx *= 0.97;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Anti-gravity wrap: float up, reappear at bottom
        if (p.y < -p.r * 2) {
          p.y = h + p.r * 2;
          p.x = Math.random() * w;
          p.vx = (Math.random() - 0.5) * 0.2;
          p.vy = p.baseVy;
        }
        if (p.x < -p.r * 2) p.x = w + p.r * 2;
        if (p.x > w + p.r * 2) p.x = -p.r * 2;

        // Iridescent hue — slowly drifts through cyan → blue → violet → purple
        const hue = (baseHue + p.hueOffset + t * 0.02) % 360;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},70%,65%,${p.opacity})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
    />
  );
}
