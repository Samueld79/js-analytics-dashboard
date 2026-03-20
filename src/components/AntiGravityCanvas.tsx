import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type ShapeType = 'circle' | 'triangle' | 'square' | 'rhombus' | 'hexagon';

type GeoShape = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  type: ShapeType;
  rgb: string;
  opacity: number;
};

const SHAPE_TYPES: ShapeType[] = ['circle', 'triangle', 'square', 'rhombus', 'hexagon'];
const COLOR_RGBS = ['6,182,212', '168,85,247'];

function makeShape(w: number, h: number): GeoShape {
  const size = Math.random() * 14 + 4;
  const baseVy = -(Math.random() * 0.3 + 0.15);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: baseVy,
    baseVy,
    size,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.012,
    type: SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)],
    rgb: COLOR_RGBS[Math.floor(Math.random() * 2)],
    opacity: Math.random() * 0.35 + 0.15,
  };
}

function drawShape(ctx: CanvasRenderingContext2D, p: GeoShape) {
  const s = p.size;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = `rgba(${p.rgb},${p.opacity})`;
  ctx.strokeStyle = `rgba(${p.rgb},${Math.min(p.opacity * 1.6, 0.6)})`;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  switch (p.type) {
    case 'circle':
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.866, s * 0.5);
      ctx.lineTo(-s * 0.866, s * 0.5);
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
      break;
    case 'rhombus':
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.6, 0);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(angle) * s, Math.sin(angle) * s);
        else ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
      }
      ctx.closePath();
      break;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

type AntiGravityCanvasProps = {
  count?: number;
  style?: CSSProperties;
};

export function AntiGravityCanvas({ count = 60, style }: AntiGravityCanvasProps) {
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

    const shapes: GeoShape[] = Array.from({ length: count }, () => makeShape(w, h));
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
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of shapes) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.hypot(dx, dy);

        if (d < 120 && d > 0) {
          // Repel proportionally to proximity
          const f = (1 - d / 120) * 1.5;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        } else {
          // Gradually restore natural upward drift
          p.vy += (p.baseVy - p.vy) * 0.04;
          p.vx *= 0.98;
        }

        // Speed cap
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 3) {
          p.vx = (p.vx / spd) * 3;
          p.vy = (p.vy / spd) * 3;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        // Anti-gravity wrap: float up and reappear at bottom
        if (p.y < -p.size * 2) {
          p.y = h + p.size * 2;
          p.x = Math.random() * w;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = p.baseVy;
        }
        if (p.x < -p.size * 2) p.x = w + p.size * 2;
        if (p.x > w + p.size * 2) p.x = -p.size * 2;

        drawShape(ctx, p);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
    />
  );
}
