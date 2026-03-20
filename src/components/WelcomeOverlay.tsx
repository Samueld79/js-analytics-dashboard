import { useEffect, useRef, useState } from 'react';

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rgb: string;
  alpha: number;
};

export function WelcomeOverlay({ name, onDone }: { name: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [exiting, setExiting] = useState(false);

  const fullText = `✦ Bienvenido, ${name}`;

  // Typewriter effect — 50 ms per character
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [fullText]);

  // Exit after 2 s → fade → call onDone
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2000);
    const doneTimer = setTimeout(onDone, 2400);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  // Canvas burst particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const cx = w / 2;
    const cy = h / 2;

    const particles: BurstParticle[] = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.3;
      const speed = Math.random() * 7 + 2;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 3 + 1,
        rgb: Math.random() > 0.5 ? '6,182,212' : '168,85,247',
        alpha: 1,
      };
    });

    let rafId: number;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      let anyAlive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        anyAlive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.alpha -= 0.008;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.rgb},${Math.max(0, p.alpha)})`;
        ctx.fill();
      }
      if (anyAlive) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const typing = displayedText.length < fullText.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8888,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(3,7,18,0.82)',
        backdropFilter: 'blur(10px)',
        transition: 'opacity 0.4s ease-out',
        opacity: exiting ? 0 : 1,
        pointerEvents: 'none',
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
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#ffffff',
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '-0.01em',
          textShadow: '0 0 40px rgba(6,182,212,0.45)',
          textAlign: 'center',
          minWidth: 280,
        }}
      >
        {displayedText}
        {typing && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1.2em',
              background: 'hsl(180,100%,55%)',
              marginLeft: 3,
              verticalAlign: 'text-bottom',
              opacity: 0.8,
            }}
          />
        )}
      </div>
    </div>
  );
}
