import { useEffect, useState } from 'react';
import { AlertTriangle, Smile } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { listCurrentMonthPulseResponses, listPulseSettings } from '../../services/pulse';
import { pulseMoodLabelFromScore, PULSE_MOOD_EMOJI, type PulseResponse } from '../../lib/supabase';

// Internal-only, aggregate across the whole portfolio — caller must gate
// this behind isInternal (a single external client must never see other
// clients' mood/tags).
export function PortfolioSatisfactionCard() {
  const { clients } = useClients();
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [enabledClientIds, setEnabledClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listCurrentMonthPulseResponses(), listPulseSettings()]).then(([rows, settings]) => {
      setResponses(rows);
      setEnabledClientIds(new Set(settings.filter((s) => s.enabled).map((s) => s.client_id)));
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const portfolioResponses = responses.filter((r) => enabledClientIds.has(r.client_id));
  if (portfolioResponses.length === 0) return null;

  const avgScore = portfolioResponses.reduce((sum, r) => sum + r.mood_score, 0) / portfolioResponses.length;
  const avgLabel = pulseMoodLabelFromScore(avgScore);

  // Each client can only respond once this month (UNIQUE client_id+month), so
  // counting occurrences of a tag = counting distinct clients that raised it.
  const tagClientCount = new Map<string, number>();
  portfolioResponses.forEach((r) => {
    r.improve_tags.forEach((tag) => tagClientCount.set(tag, (tagClientCount.get(tag) ?? 0) + 1));
  });
  const rankedTags = [...tagClientCount.entries()].sort((a, b) => b[1] - a[1]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Cliente';

  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Smile size={14} style={{ color: 'var(--cyan)' }} />
        <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
          Satisfacción de la cartera · este mes
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '2rem' }}>{PULSE_MOOD_EMOJI[avgLabel]}</span>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', lineHeight: 1 }}>
              {avgScore.toFixed(0)}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
              {avgLabel} · {portfolioResponses.length} {portfolioResponses.length === 1 ? 'respuesta' : 'respuestas'}
            </div>
          </div>
        </div>

        <div>
          {rankedTags.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--fg-muted)' }}>Sin sugerencias de mejora este mes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {rankedTags.slice(0, 4).map(([tag, count]) => {
                const sharedAcrossClients = count > 1;
                return (
                  <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sharedAcrossClients && <AlertTriangle size={11} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
                    <span style={{ fontSize: '0.72rem', color: sharedAcrossClients ? 'var(--warning)' : 'var(--fg-2)' }}>
                      {tag}
                    </span>
                    <span style={{ fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
                      · {count} {count === 1 ? 'cliente' : 'clientes'}
                      {count === 1 ? ` (${clientName(portfolioResponses.find((r) => r.improve_tags.includes(tag))?.client_id ?? '')})` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
