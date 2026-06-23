import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TOOL_CONFIGS } from './toolConfigs';
import { listToolOutputs } from '../../services/aiToolsService';

const VISIBLE_TOOL_KEYS = ['carrusel', 'dm', 'analizar'];
const FEATURED_KEY = 'estrategia';
const ALL_COUNTED_KEYS = [FEATURED_KEY, ...VISIBLE_TOOL_KEYS];

function SectionBadge({ label, color }: { label: string; color: string }) {
  const className = color === 'green' ? 'badge badge-success' : 'badge badge-muted';
  return (
    <span
      className={className}
      style={{ marginLeft: 8, verticalAlign: 'middle', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}
    >
      {label}
    </span>
  );
}

function ToolCard({ toolKey, highlight = false, count }: { toolKey: string; highlight?: boolean; count?: number }) {
  const tool = TOOL_CONFIGS.find((t) => t.key === toolKey);
  if (!tool) return null;

  return (
    <Link to={`/ai-tools/${tool.key}`} className={highlight ? 'ai-featured-card' : 'ai-tool-card'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: highlight ? '1.5rem' : '1.2rem' }}>{tool.emoji}</span>
        <span style={{ fontSize: highlight ? '1rem' : '0.9rem', fontWeight: 700, color: 'var(--fg)', flex: 1, fontFamily: 'Outfit, sans-serif' }}>
          {tool.title}
        </span>
        {highlight && (
          <span className="badge badge-muted" style={{ background: 'var(--cyan)', color: 'oklch(0.12 0.03 250)', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px' }}>
            Principal
          </span>
        )}
      </div>
      <p style={{ fontSize: highlight ? '0.84rem' : '0.78rem', color: 'var(--fg-2)', margin: 0, lineHeight: 1.55 }}>
        {tool.description}
      </p>
      {highlight && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {['IA', 'Formulario', 'Imagen', 'Transcripción'].map((lbl) => (
            <span key={lbl} className="badge badge-muted" style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--cyan-border)', borderRadius: 999 }}>{lbl}</span>
          ))}
        </div>
      )}
      {typeof count === 'number' && count > 0 && (
        <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', marginTop: 8 }}>
          {count} {count === 1 ? 'estrategia generada' : 'estrategias generadas'}
        </div>
      )}
    </Link>
  );
}

const USER_SECTIONS = [
  {
    label: '✏️ Para Juanca — Creación',
    badge: '✏️ Para Juanca',
    badgeColor: 'green',
    keys: ['carrusel', 'dm'],
  },
  {
    label: '📊 Para Samuel — Análisis',
    badge: '📊 Para Samuel',
    badgeColor: 'blue',
    keys: ['analizar'],
  },
];

export function AIToolsHome() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    void Promise.all(
      ALL_COUNTED_KEYS.map(async (k) => {
        const rows = await listToolOutputs({ toolKey: k, limit: 999 });
        return [k, rows.length] as [string, number];
      }),
    ).then((pairs) => {
      if (!active) return;
      setCounts(Object.fromEntries(pairs));
    });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Featured: Estrategia */}
      <section>
        <p style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
          color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Estrategia — Herramienta principal
        </p>
        <ToolCard toolKey={FEATURED_KEY} highlight count={counts[FEATURED_KEY]} />
      </section>

      {/* Other tools */}
      {USER_SECTIONS.map(({ label, badge, badgeColor, keys }) => {
        const tools = keys.filter((k) => VISIBLE_TOOL_KEYS.includes(k));
        if (!tools.length) return null;
        return (
          <section key={label}>
            <p style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 12,
            }}>
              {label.split(' — ')[0]}
              <SectionBadge label={badge} color={badgeColor} />
              <span style={{ opacity: 0.5, marginLeft: 6, fontWeight: 400, color: 'var(--fg-muted)' }}>
                — {label.split(' — ')[1]}
              </span>
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {tools.map((key) => (
                <ToolCard key={key} toolKey={key} count={counts[key]} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
