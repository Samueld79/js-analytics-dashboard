import { useState, type FormEvent } from 'react';
import { Loader2, Lock, Mail, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn({ email, password });
    if (result.error) {
      setError(result.error);
    }

    setLoading(false);
  }

  return (
    <div className="auth-shell">
      <div className="page-bg" />
      <div className="auth-card card section-block">
        <div className="auth-header">
          <div className="auth-logo">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="page-title">Agency OS</h1>
            <p className="page-subtitle">Acceso seguro al sistema y workspace privado</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">Correo</span>
            <div className="auth-input-wrap">
              <Mail size={15} />
              <input
                type="email"
                className="form-input"
                placeholder="equipo@agencia.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="form-field">
            <span className="form-label">Contrasena</span>
            <div className="auth-input-wrap">
              <Lock size={15} />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error && <p className="empty-note auth-error">{error}</p>}

          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="spin" /> Entrando...
              </>
            ) : (
              'Iniciar sesion'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
