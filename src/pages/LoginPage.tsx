import { useState, type CSSProperties, type FormEvent } from 'react';
import { Loader2, Lock, Mail } from 'lucide-react';
import { StardustCanvas } from '../components/StardustCanvas';
import brandLogo from '../assets/brand-logo.png';
import { useAuth } from '../hooks/useAuth';

const CARD: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 420,
  maxWidth: 'calc(100vw - 32px)',
  padding: '48px',
  background: 'rgba(3,7,18,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(6,182,212,0.2)',
  borderRadius: 16,
  boxShadow: '0 0 40px rgba(6,182,212,0.08)',
};

type FocusState = { email: boolean; password: boolean };

function floatingLabel(value: string, focused: boolean): CSSProperties {
  const up = Boolean(value) || focused;
  return {
    position: 'absolute',
    left: 44,
    top: up ? 8 : '50%',
    transform: up ? 'none' : 'translateY(-50%)',
    transition: 'top 0.18s ease, transform 0.18s ease, font-size 0.18s ease, color 0.18s ease',
    fontSize: up ? '0.6rem' : '0.88rem',
    color: focused ? 'hsl(180,100%,55%)' : 'rgba(255,255,255,0.35)',
    pointerEvents: 'none',
    letterSpacing: up ? '0.08em' : 'normal',
    fontFamily: up ? 'JetBrains Mono, monospace' : 'inherit',
    userSelect: 'none',
  };
}

function inputWrap(focused: boolean): CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${focused ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 8,
    boxShadow: focused ? '0 0 0 3px rgba(6,182,212,0.07)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    height: 54,
    overflow: 'hidden',
  };
}

const INPUT: CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#fff',
  fontSize: '0.88rem',
  paddingLeft: 44,
  paddingRight: 16,
  paddingBottom: 0,
};

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<FocusState>({ email: false, password: false });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn({ email, password });
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  const iconColor = (f: boolean) => ({
    position: 'absolute' as const,
    left: 16,
    color: f ? 'hsl(180,100%,55%)' : 'rgba(255,255,255,0.28)',
    transition: 'color 0.15s',
    pointerEvents: 'none' as const,
    flexShrink: 0,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
      }}
    >
      <StardustCanvas />

      <div
        style={{
          ...CARD,
          opacity: loading ? 0 : 1,
          transform: loading ? 'scale(0.94)' : 'scale(1)',
          transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src={brandLogo}
            alt="Growth Strategy"
            style={{ width: 42, height: 42, objectFit: 'contain', marginBottom: 14 }}
          />
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#ffffff',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            Growth Strategy<span style={{ color: '#06b6d4' }}>.</span>
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'rgba(6,182,212,0.55)',
              letterSpacing: '0.2em',
              marginTop: 6,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            ACCESO AL PANEL
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Email */}
          <div style={{ position: 'relative' }}>
            <div style={inputWrap(focused.email)}>
              <Mail size={15} style={iconColor(focused.email)} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused((f) => ({ ...f, email: true }))}
                onBlur={() => setFocused((f) => ({ ...f, email: false }))}
                autoComplete="email"
                required
                style={{
                  ...INPUT,
                  paddingTop: email || focused.email ? 18 : 0,
                  transition: 'padding-top 0.18s',
                }}
              />
            </div>
            <span style={floatingLabel(email, focused.email)}>CORREO</span>
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <div style={inputWrap(focused.password)}>
              <Lock size={15} style={iconColor(focused.password)} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused((f) => ({ ...f, password: true }))}
                onBlur={() => setFocused((f) => ({ ...f, password: false }))}
                autoComplete="current-password"
                required
                style={{
                  ...INPUT,
                  paddingTop: password || focused.password ? 18 : 0,
                  transition: 'padding-top 0.18s',
                }}
              />
            </div>
            <span style={floatingLabel(password, focused.password)}>CONTRASEÑA</span>
          </div>

          {error && (
            <p
              style={{
                margin: 0,
                fontSize: '0.76rem',
                color: 'hsl(0,84%,65%)',
                textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%',
              height: 48,
              background: loading ? 'rgba(6,182,212,0.5)' : '#06b6d4',
              border: 'none',
              borderRadius: 8,
              color: '#030712',
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '0.1em',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: loading ? 'none' : '0 0 20px rgba(6,182,212,0.25)',
              transition: 'background 0.2s, box-shadow 0.2s, filter 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = 'none';
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" /> ENTRANDO...
              </>
            ) : (
              'INICIAR SESIÓN'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
