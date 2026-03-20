import { useEffect, useState } from 'react';
import brandLogo from '../assets/brand-logo.png';
import { AntiGravityCanvas } from './AntiGravityCanvas';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Progress 0 → 100% over 1.5 s
  useEffect(() => {
    const start = performance.now();
    let rafId: number;
    const tick = () => {
      const p = Math.min((performance.now() - start) / 1500, 1);
      setProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Exit at 1.6 s → fade 400 ms → done at 2 s
  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 1600);
    const doneTimer = setTimeout(onDone, 2000);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

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
        transform: exiting ? 'scale(1.03)' : 'scale(1)',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <AntiGravityCanvas count={60} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img
          src={brandLogo}
          alt="Growth Strategy"
          style={{ width: 54, height: 54, objectFit: 'contain' }}
        />
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.01em',
            marginTop: 4,
          }}
        >
          Growth Strategy<span style={{ color: '#06b6d4' }}>.</span>
        </div>

        <div style={{ width: 220, marginTop: 22 }}>
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
                boxShadow: '0 0 6px #06b6d4',
                borderRadius: 1,
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
