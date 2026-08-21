import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Smile } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { currentMonthFirstDay, listPulseResponsesByMonth, listPulseSettings } from '../services/pulse';
import { pulseMoodLabelFromScore, PULSE_MOOD_EMOJI, type PulseResponse, type PulseSettings } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import { getMonthLabel } from '../utils/monthLabel';

function monthOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  return options;
}

export function SatisfactionPage() {
  const { clients } = useClients();
  const [month, setMonth] = useState(() => currentMonthFirstDay());
  const [settings, setSettings] = useState<PulseSettings[]>([]);
  const [responses, setResponses] = useState<PulseResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listPulseSettings().then(setSettings);
  }, []);

  useEffect(() => {
    setLoading(true);
    listPulseResponsesByMonth(month).then((rows) => {
      setResponses(rows);
      setLoading(false);
    });
  }, [month]);

  const enabledClientIds = useMemo(
    () => new Set(settings.filter((s) => s.enabled).map((s) => s.client_id)),
    [settings],
  );

  const responseByClientId = useMemo(
    () => new Map(responses.map((r) => [r.client_id, r])),
    [responses],
  );

  // Each client can only respond once per month (UNIQUE client_id+month), so
  // counting occurrences of a tag in this month's responses = counting
  // distinct clients that raised it — a repeat here is an agency-wide signal.
  const repeatedImproveTags = useMemo(() => {
    const tagClientCount = new Map<string, number>();
    responses.forEach((r) => {
      if (!enabledClientIds.has(r.client_id)) return;
      r.improve_tags.forEach((tag) => tagClientCount.set(tag, (tagClientCount.get(tag) ?? 0) + 1));
    });
    return new Set([...tagClientCount.entries()].filter(([, count]) => count > 1).map(([tag]) => tag));
  }, [responses, enabledClientIds]);

  const rows = useMemo(() => {
    return clients
      .filter((c) => enabledClientIds.has(c.id))
      .map((c) => ({ client: c, response: responseByClientId.get(c.id) ?? null }))
      .sort((a, b) => {
        if (!!a.response !== !!b.response) return a.response ? -1 : 1;
        return a.client.name.localeCompare(b.client.name);
      });
  }, [clients, enabledClientIds, responseByClientId]);

  const monthResponses = rows.map((r) => r.response).filter((r): r is PulseResponse => r !== null);
  const avgScore = monthResponses.length > 0
    ? monthResponses.reduce((sum, r) => sum + r.mood_score, 0) / monthResponses.length
    : null;
  const avgLabel = avgScore != null ? pulseMoodLabelFromScore(avgScore) : null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Satisfacción</h1>
          <p className="page-subtitle">PULSO MENSUAL DE SATISFACCIÓN POR CLIENTE</p>
        </div>
        <select
          className="dash-period-select"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {monthOptions().map((m) => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Smile size={14} style={{ color: 'var(--cyan)' }} />
            <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Resumen · {getMonthLabel(month)}
            </span>
          </div>

          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
              Ningún cliente tiene el Pulso de Satisfacción habilitado todavía.
            </p>
          ) : avgScore == null || avgLabel == null ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
              Todavía no hay respuestas este mes.
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '2rem' }}>{PULSE_MOOD_EMOJI[avgLabel]}</span>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', lineHeight: 1 }}>
                  {avgScore.toFixed(0)}
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--fg-muted)' }}>
                  {avgLabel} · {monthResponses.length} de {rows.length} {rows.length === 1 ? 'cliente respondió' : 'clientes respondieron'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
              Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
              Ningún cliente tiene el Pulso de Satisfacción habilitado. Actívalo desde Portal Cliente.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'Ánimo', 'Le gustó', 'Por mejorar', 'Nota', 'Fecha'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--fg-muted)', fontWeight: 500, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ client, response }) => (
                    <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--fg)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {client.name}
                      </td>
                      {!response ? (
                        <td colSpan={5} style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20, background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                            <Clock size={11} /> Pendiente de responder
                          </span>
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '1.1rem', marginRight: 6 }}>{PULSE_MOOD_EMOJI[response.mood_label]}</span>
                            <span style={{ color: 'var(--fg)' }}>{response.mood_label}</span>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {response.liked_tags.length === 0 ? (
                                <span style={{ color: 'var(--fg-muted)' }}>—</span>
                              ) : (
                                response.liked_tags.map((tag) => (
                                  <span key={tag} style={{ fontSize: '0.66rem', padding: '2px 8px', borderRadius: 4, background: 'var(--success-dim)', color: 'var(--success)' }}>
                                    {tag}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {response.improve_tags.length === 0 ? (
                                <span style={{ color: 'var(--fg-muted)' }}>—</span>
                              ) : (
                                response.improve_tags.map((tag) => {
                                  const shared = repeatedImproveTags.has(tag);
                                  return (
                                    <span
                                      key={tag}
                                      title={shared ? 'Este tag se repite en varios clientes este mes — posible problema del lado de la agencia' : undefined}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: '0.66rem', padding: '2px 8px', borderRadius: 4,
                                        background: shared ? 'var(--warning-dim)' : 'var(--surface-2)',
                                        color: shared ? 'var(--warning)' : 'var(--fg-2)',
                                        border: shared ? '1px solid var(--warning)' : '1px solid transparent',
                                      }}
                                    >
                                      {shared && <AlertTriangle size={10} />}
                                      {tag}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 260, color: 'var(--fg-2)', whiteSpace: 'pre-wrap' }}>
                            {response.note?.trim() ? response.note : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--fg-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            {formatDateTime(response.submitted_at)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
