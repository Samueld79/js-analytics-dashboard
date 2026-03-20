import { useEffect, useRef, useState } from 'react';
import brandLogo from '../assets/brand-logo.png';

const MESSAGES = [
  'Cargando datos...',
  'Conectando con Meta...',
  'Preparando dashboard...',
  'Listo',
];

const PARTICLE_COLORS_RGB = ['6,182,212', '168,85,247', '255,255,255'];

type SplashParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rgb: string;
  opacity: number;
};

function makeSplashParticle(w: number, h: number): SplashParticle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    r: Math.random() * 3 + 1,
    rgb: PARTICLE_COLORS_RGB[Math.floor(Math.random() * PARTICLE_COLORS_RGB.length)],
    opacity: Math.random() * 0.6 + 0.2,
  };
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Progress 0 → 100% over 2 s
  useEffect(() => {
    const start = performance.now();
    let rafId: number;
    const tick = () => {
      const p = Math.min((performance.now() - start) / 2000, 1);
      setProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Message cycling every 500 ms
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Exit after 2.5 s → fade 400 ms → call onDone
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2500);
    const doneTimer = setTimeout(onDone, 2900);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  // Canvas particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles: SplashParticle[] = Array.from({ length: 80 }, () =>
      makeSplashParticle(w, h),
    );

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

      for (const p of particles) {
        // Brownian nudge
        p.vx += (Math.random() - 0.5) * 0.04;
        p.vy += (Math.random() - 0.5) * 0.04;
        // Speed cap
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 1) {
          p.vx /= spd;
          p.vy /= spd;
        }
        // Mouse repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const d = Math.hypot(dx, dy);
        if (d < 100 && d > 0) {
          const f = (1 - d / 100) * 0.8;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        // Move + wrap
        p.x = ((p.x + p.vx) % w + w) % w;
        p.y = ((p.y + p.vy) % h + h) % h;
      }

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(6,182,212,${(1 - d / 120) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.rgb},${p.opacity})`;
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.05)' : 'scale(1)',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src={brandLogo}
          alt="Growth Strategy"
          style={{ width: 64, height: 64, objectFit: 'contain' }}
        />
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.01em',
            marginTop: 8,
          }}
        >
          Growth Strategy<span style={{ color: '#06b6d4' }}>.</span>
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#06b6d4',
            letterSpacing: '0.2em',
            fontWeight: 600,
          }}
        >
          AGENCIA / META ADS
        </div>

        <div style={{ width: 280, marginTop: 28 }}>
          <div
            style={{
              height: 2,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #06b6d4, #a855f7)',
                boxShadow: '0 0 8px #06b6d4',
                borderRadius: 1,
                transition: 'width 0.05s linear',
              }}
            />
          </div>
          <p
            style={{
              marginTop: 14,
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.38)',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              minHeight: 18,
              letterSpacing: '0.04em',
            }}
          >
            {MESSAGES[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
