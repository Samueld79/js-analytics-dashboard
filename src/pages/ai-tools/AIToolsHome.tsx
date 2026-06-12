import { Link } from 'react-router-dom';
import { TOOL_CONFIGS, SECTION_LABELS } from './toolConfigs';

const SECTION_ORDER = ['estrategia', 'creacion', 'video_analisis'] as const;

export function AIToolsHome() {
  const sections = SECTION_ORDER.map((sec) => ({
    key: sec,
    label: SECTION_LABELS[sec],
    tools: TOOL_CONFIGS.filter((t) => t.section === sec),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {sections.map(({ key, label, tools }) => (
        <section key={key}>
          <p style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            {label}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {tools.map((tool) => (
              <Link
                key={tool.key}
                to={`/ai-tools/${tool.key}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent-cyan)';
                    (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--color-accent-cyan) 4%, var(--color-bg-card))';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg-card)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>{tool.emoji}</span>
                    <span style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      {tool.title}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.78rem',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    {tool.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
