import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TOOL_CONFIGS } from './toolConfigs';
import { listToolOutputs } from '../../services/aiToolsService';

const VISIBLE_TOOL_KEYS = ['carrusel', 'dm', 'analizar'];
const FEATURED_KEY = 'estrategia';
const ALL_COUNTED_KEYS = [FEATURED_KEY, ...VISIBLE_TOOL_KEYS];

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green: {
    bg: 'color-mix(in srgb, #22c55e 12%, transparent)',
    text: '#22c55e',
    border: 'color-mix(in srgb, #22c55e 25%, transparent)',
  },
  blue: {
    bg: 'color-mix(in srgb, #3b82f6 12%, transparent)',
    text: '#3b82f6',
    border: 'color-mix(in srgb, #3b82f6 25%, transparent)',
  },
};

function SectionBadge({ label, color }: { label: string; color: string }) {
  const c = BADGE_COLORS[color];
  if (!c) return null;
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      marginLeft: 8,
      verticalAlign: 'middle',
    }}>
      {label}
    </span>
  );
}

function ToolCard({
  toolKey,
  highlight = false,
  count,
}: {
  toolKey: string;
  highlight?: boolean;
  count?: number;
}) {
  const tool = TOOL_CONFIGS.find((t) => t.key === toolKey);
  if (!tool) return null;

  return (
    <Link to={`/ai-tools/${tool.key}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: highlight
            ? 'color-mix(in srgb, var(--color-accent-cyan) 8%, var(--color-bg-card))'
            : 'var(--color-bg-card)',
          border: highlight
            ? '2px solid var(--color-accent-cyan)'
            : '1px solid var(--color-border)',
          borderRadius: 14,
          padding: highlight ? '22px 24px' : '18px 20px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = 'var(--color-accent-cyan)';
          el.style.background = 'color-mix(in srgb, var(--color-accent-cyan) 8%, var(--color-bg-card))';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = highlight ? 'var(--color-accent-cyan)' : 'var(--color-border)';
          el.style.background = highlight
            ? 'color-mix(in srgb, var(--color-accent-cyan) 8%, var(--color-bg-card))'
            : 'var(--color-bg-card)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: highlight ? '1.7rem' : '1.4rem' }}>{tool.emoji}</span>
          <span style={{
            fontSize: highlight ? '1rem' : '0.9rem',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontFamily: 'Outfit, sans-serif',
            flex: 1,
          }}>
            {tool.title}
          </span>
          {highlight && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
              padding: '2px 9px', borderRadius: 20,
              background: 'var(--color-accent-cyan)',
              color: 'var(--color-accent-cyan-fg, #000)',
              textTransform: 'uppercase',
            }}>
              Principal
            </span>
          )}
        </div>

        <p style={{
          fontSize: highlight ? '0.84rem' : '0.78rem',
          color: 'var(--color-text-secondary)',
          margin: 0,
          lineHeight: 1.55,
        }}>
          {tool.description}
        </p>

        {highlight && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['✨ IA', '📋 Formulario', '🖼️ Imagen', '🎙️ Transcripción'].map((lbl) => (
              <span key={lbl} style={{
                fontSize: '0.7rem', padding: '3px 9px', borderRadius: 20,
                background: 'color-mix(in srgb, var(--color-accent-cyan) 15%, transparent)',
                color: 'var(--color-accent-cyan)',
                border: '1px solid color-mix(in srgb, var(--color-accent-cyan) 25%, transparent)',
              }}>
                {lbl}
              </span>
            ))}
          </div>
        )}

        {typeof count === 'number' && count > 0 && (
          <div style={{
            fontSize: '0.68rem', color: 'var(--color-text-muted)',
            marginTop: 2,
          }}>
            {count} {count === 1 ? 'estrategia generada' : 'estrategias generadas'}
          </div>
        )}
      </div>
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
          color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          ⚡ Estrategia — Herramienta principal
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
              color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12,
            }}>
              {label.split(' — ')[0]}
              <SectionBadge label={badge} color={badgeColor} />
              <span style={{ opacity: 0.5, marginLeft: 6, fontWeight: 400 }}>
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
