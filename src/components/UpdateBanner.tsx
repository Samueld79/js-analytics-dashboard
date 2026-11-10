import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Se monta una sola vez en el layout raíz de la app interna (ver App.tsx).
// No usa ninguna librería nueva: solo fetch + visibilitychange nativos.
// Compara __APP_VERSION__ (inyectado en build time por vite.config.ts)
// contra /version.json, que se reescribe en cada build/deploy.
export function UpdateBanner() {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { version?: string };
        if (!cancelled && data.version && data.version !== __APP_VERSION__) {
          setNewVersionAvailable(true);
        }
      } catch {
        // Sin conexión o version.json no disponible — no romper la app.
      }
    }

    void checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    function handleVisibility() {
      if (!document.hidden) void checkVersion();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!newVersionAvailable) return null;

  return (
    <div
      className="card-glass"
      role="status"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        maxWidth: 320,
      }}
    >
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--fg)', lineHeight: 1.3 }}>
        Hay una versión nueva de la plataforma
      </p>
      <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => location.reload()}>
        Actualizar
      </button>
    </div>
  );
}
