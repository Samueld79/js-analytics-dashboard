import { useEffect, useState } from 'react';
import { getClientDiagnostic, upsertClientDiagnostic } from '../../services/diagnostics';
import { setClientWhatsappApi } from '../../services/clients';
import {
  DIAGNOSTIC_SERVICE_CHANNELS,
  type ClientDiagnostic,
  type ClientDiagnosticInput,
  type DiagnosticServiceChannel,
} from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';

const SERVICE_CHANNEL_LABEL: Record<DiagnosticServiceChannel, string> = {
  whatsapp_personal: 'WhatsApp personal',
  whatsapp_business: 'WhatsApp Business',
  api: 'API de WhatsApp',
  dm_instagram: 'DM Instagram',
  llamadas: 'Llamadas',
  formulario_web: 'Formulario web',
  presencial: 'Presencial',
};

const AD_BUDGET_RANGE_OPTIONS = [
  { value: 'lt_500k', label: '< $500.000' },
  { value: '500k_1_5m', label: '$500.000 – $1.5M' },
  { value: '1_5m_3m', label: '$1.5M – $3M' },
  { value: '3m_5m', label: '$3M – $5M' },
  { value: 'gt_5m', label: '> $5M' },
] as const;

const WILLING_TO_SCALE_OPTIONS = [
  { value: 'si_rentable', label: 'Sí, si es rentable' },
  { value: 'depende', label: 'Depende' },
  { value: 'no_fijo', label: 'No, presupuesto fijo' },
] as const;

const PRIOR_ADVERTISING_OPTIONS = [
  { value: 'si_buenos', label: 'Sí, con buenos resultados' },
  { value: 'si_regulares_malos', label: 'Sí, con resultados regulares o malos' },
  { value: 'nunca', label: 'Nunca ha pautado' },
] as const;

const SALES_TEAM_OPTIONS = [
  { value: 'equipo_dedicado', label: 'Equipo dedicado' },
  { value: 'dueno', label: 'El dueño' },
  { value: 'compartido', label: 'Compartido con otras tareas' },
  { value: 'no_tienen', label: 'No tienen' },
] as const;

const RESPONSE_TIME_OPTIONS = [
  { value: 'lt_30min', label: '< 30 min' },
  { value: '30min_2h', label: '30 min – 2 h' },
  { value: 'mismo_dia', label: 'Mismo día' },
  { value: 'gt_1_dia', label: '> 1 día' },
] as const;

const CONTENT_CREATOR_OPTIONS = [
  { value: 'interno', label: 'Equipo interno' },
  { value: 'externo', label: 'Externo' },
  { value: 'dueno', label: 'El dueño' },
  { value: 'no_tienen', label: 'No tienen' },
] as const;

const AUDIOVISUAL_OPTIONS = [
  { value: 'bastante', label: 'Bastante material' },
  { value: 'necesita_refresco', label: 'Necesita refresco' },
  { value: 'muy_poco', label: 'Muy poco' },
  { value: 'nada', label: 'Nada' },
] as const;

const OPERATIONAL_CAPACITY_OPTIONS = [
  { value: 'listos', label: 'Listos para escalar' },
  { value: 'ajustes_menores', label: 'Necesitan ajustes menores' },
  { value: 'necesitan_tiempo', label: 'Necesitan tiempo' },
] as const;

const TOP_SALES_CHANNEL_OPTIONS = [
  { value: 'punto_fisico', label: 'Punto físico' },
  { value: 'redes_whatsapp', label: 'Redes / WhatsApp' },
  { value: 'web_ecommerce', label: 'Web / e-commerce' },
  { value: 'otro', label: 'Otro' },
] as const;

const DATA_DRIVEN_OPTIONS = [
  { value: 'totalmente', label: 'Totalmente — decide con datos' },
  { value: 'con_confianza', label: 'Con confianza, pero valida con la intuición' },
  { value: 'paso_a_paso', label: 'Paso a paso, le cuesta soltar el control' },
] as const;

function emptyForm(clientId: string): ClientDiagnosticInput {
  return {
    client_id: clientId,
    diagnostic_date: new Date().toISOString().split('T')[0],
    company_contact: '',
    main_objective: '',
    expected_3_months: '',
    avg_monthly_sales_cop: null,
    avg_ticket_cop: null,
    avg_daily_sales: null,
    avg_margin: '',
    ad_budget_range: null,
    willing_to_scale: null,
    prior_advertising: null,
    prior_platforms: '',
    months_in_market: null,
    prior_ad_spend_notes: '',
    sales_team: null,
    service_channels: [],
    response_time: null,
    content_creator: null,
    content_pieces_per_month: null,
    audiovisual_material: null,
    operational_capacity: null,
    top_sales_channel: null,
    top_sales_channel_other: '',
    data_driven: null,
    upcoming_dates: '',
    motivation: '',
    extra_notes: '',
  };
}

function toForm(d: ClientDiagnostic): ClientDiagnosticInput {
  return {
    client_id: d.client_id,
    diagnostic_date: d.diagnostic_date,
    company_contact: d.company_contact,
    main_objective: d.main_objective,
    expected_3_months: d.expected_3_months,
    avg_monthly_sales_cop: d.avg_monthly_sales_cop,
    avg_ticket_cop: d.avg_ticket_cop,
    avg_daily_sales: d.avg_daily_sales,
    avg_margin: d.avg_margin,
    ad_budget_range: d.ad_budget_range,
    willing_to_scale: d.willing_to_scale,
    prior_advertising: d.prior_advertising,
    prior_platforms: d.prior_platforms,
    months_in_market: d.months_in_market,
    prior_ad_spend_notes: d.prior_ad_spend_notes,
    sales_team: d.sales_team,
    service_channels: d.service_channels,
    response_time: d.response_time,
    content_creator: d.content_creator,
    content_pieces_per_month: d.content_pieces_per_month,
    audiovisual_material: d.audiovisual_material,
    operational_capacity: d.operational_capacity,
    top_sales_channel: d.top_sales_channel,
    top_sales_channel_other: d.top_sales_channel_other,
    data_driven: d.data_driven,
    upcoming_dates: d.upcoming_dates,
    motivation: d.motivation,
    extra_notes: d.extra_notes,
  };
}

function labelFor<T extends string>(options: ReadonlyArray<{ value: T; label: string }>, value: T | null): string {
  return options.find((o) => o.value === value)?.label ?? '—';
}

type Props = {
  clientId: string;
  clientHasWhatsappApi: boolean;
  onWhatsappApiActivated?: () => void;
};

// Interno únicamente (is_internal_user) — nunca se monta en /portal/:id ni
// /cliente/:slug. Ver ClientDetailPage: solo aparece dentro del bloque
// gateado por showInternalTools.
export function ClientDiagnosticTab({ clientId, clientHasWhatsappApi, onWhatsappApiActivated }: Props) {
  const [diagnostic, setDiagnostic] = useState<ClientDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientDiagnosticInput>(() => emptyForm(clientId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getClientDiagnostic(clientId);
      if (cancelled) return;
      setDiagnostic(data);
      setForm(data ? toForm(data) : emptyForm(clientId));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function setField<K extends keyof ClientDiagnosticInput>(field: K, value: ClientDiagnosticInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleChannel(channel: DiagnosticServiceChannel) {
    setForm((current) => ({
      ...current,
      service_channels: current.service_channels.includes(channel)
        ? current.service_channels.filter((c) => c !== channel)
        : [...current.service_channels, channel],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const result = await upsertClientDiagnostic(form);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setDiagnostic(result.data);
    if (result.data) setForm(toForm(result.data));
    setEditing(false);
    setSaving(false);
  }

  async function handleApplyWhatsappSuggestion() {
    setApplyingSuggestion(true);
    const result = await setClientWhatsappApi(clientId, true);
    setApplyingSuggestion(false);
    if (!result.error) onWhatsappApiActivated?.();
  }

  const suggestWhatsappApi =
    !clientHasWhatsappApi && (diagnostic?.service_channels ?? form.service_channels).includes('api');

  if (loading) {
    return (
      <div className="card-glass card-padded">
        <p className="empty-note">Cargando diagnóstico...</p>
      </div>
    );
  }

  if (!diagnostic && !editing) {
    return (
      <div className="card-glass card-padded" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <p style={{ marginBottom: 14, color: 'var(--fg-2)' }}>Sin diagnóstico aún.</p>
        <button className="btn-primary" onClick={() => setEditing(true)}>
          Completar diagnóstico
        </button>
      </div>
    );
  }

  if (!editing && diagnostic) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {suggestWhatsappApi && (
          <div
            className="card-glass"
            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: '1px solid var(--cyan-border)' }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-2)' }}>
              El diagnóstico indica que atienden por API de WhatsApp — ¿marcarlo también en la ficha del cliente?
            </span>
            <button className="btn-secondary" disabled={applyingSuggestion} onClick={() => void handleApplyWhatsappSuggestion()}>
              {applyingSuggestion ? 'Marcando...' : 'Marcar API de WhatsApp activa'}
            </button>
          </div>
        )}

        <div className="card-glass card-padded">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="number-label">Resumen del diagnóstico</div>
            <button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>
          </div>
          <div className="portal-kpi-grid">
            <div className="portal-kpi-card">
              <p className="portal-kpi-label">Invierte</p>
              <p className="portal-kpi-value" style={{ fontSize: '1rem' }}>{labelFor(AD_BUDGET_RANGE_OPTIONS, diagnostic.ad_budget_range)}</p>
            </div>
            <div className="portal-kpi-card">
              <p className="portal-kpi-label">Dónde ha pautado</p>
              <p className="portal-kpi-value" style={{ fontSize: '0.9rem' }}>{diagnostic.prior_platforms || '—'}</p>
            </div>
            <div className="portal-kpi-card">
              <p className="portal-kpi-label">Tiempo en el mercado</p>
              <p className="portal-kpi-value">{diagnostic.months_in_market != null ? `${diagnostic.months_in_market} meses` : '—'}</p>
            </div>
            <div className="portal-kpi-card">
              <p className="portal-kpi-label">Ticket promedio</p>
              <p className="portal-kpi-value">{diagnostic.avg_ticket_cop != null ? formatCopExact(diagnostic.avg_ticket_cop) : '—'}</p>
            </div>
            <div className="portal-kpi-card">
              <p className="portal-kpi-label">Canal principal de ventas</p>
              <p className="portal-kpi-value" style={{ fontSize: '0.9rem' }}>
                {diagnostic.top_sales_channel === 'otro' && diagnostic.top_sales_channel_other
                  ? diagnostic.top_sales_channel_other
                  : labelFor(TOP_SALES_CHANNEL_OPTIONS, diagnostic.top_sales_channel)}
              </p>
            </div>
          </div>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>01 · Objetivo y expectativas</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Objetivo:</strong> {diagnostic.main_objective || '—'}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Expectativa a 3 meses:</strong> {diagnostic.expected_3_months || '—'}</p>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>02 · Ventas y ticket promedio</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--fg-2)' }}>
            <span>Ventas mensuales promedio: <strong style={{ color: 'var(--fg)' }}>{diagnostic.avg_monthly_sales_cop != null ? formatCopExact(diagnostic.avg_monthly_sales_cop) : '—'}</strong></span>
            <span>Ventas diarias promedio: <strong style={{ color: 'var(--fg)' }}>{diagnostic.avg_daily_sales != null ? formatCopExact(diagnostic.avg_daily_sales) : '—'}</strong></span>
            <span>Margen: <strong style={{ color: 'var(--fg)' }}>{diagnostic.avg_margin || '—'}</strong></span>
          </div>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>03 · Inversión en pauta</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="status-pill" style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--cyan-border)' }}>
              {labelFor(WILLING_TO_SCALE_OPTIONS, diagnostic.willing_to_scale)}
            </span>
            <span className="status-pill" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}>
              {labelFor(PRIOR_ADVERTISING_OPTIONS, diagnostic.prior_advertising)}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--fg-2)' }}>{diagnostic.prior_ad_spend_notes || 'Sin notas adicionales.'}</p>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>04 · Área comercial</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="status-pill" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}>
              {labelFor(SALES_TEAM_OPTIONS, diagnostic.sales_team)}
            </span>
            <span className="status-pill" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}>
              Responde en {labelFor(RESPONSE_TIME_OPTIONS, diagnostic.response_time).toLowerCase()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {diagnostic.service_channels.map((c) => (
              <span key={c} className="meta-chip">{SERVICE_CHANNEL_LABEL[c]}</span>
            ))}
          </div>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>05 · Contenido</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--fg-2)' }}>
            <span>Creador: <strong style={{ color: 'var(--fg)' }}>{labelFor(CONTENT_CREATOR_OPTIONS, diagnostic.content_creator)}</strong></span>
            <span>Piezas/mes: <strong style={{ color: 'var(--fg)' }}>{diagnostic.content_pieces_per_month ?? '—'}</strong></span>
            <span>Material audiovisual: <strong style={{ color: 'var(--fg)' }}>{labelFor(AUDIOVISUAL_OPTIONS, diagnostic.audiovisual_material)}</strong></span>
          </div>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>06 · Operación y capacidad</div>
          <span className="status-pill" style={{ background: 'var(--surface-3)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}>
            {labelFor(OPERATIONAL_CAPACITY_OPTIONS, diagnostic.operational_capacity)}
          </span>
        </div>

        <div className="card-glass card-padded">
          <div className="number-label" style={{ marginBottom: 10 }}>07 · Ajuste y compromiso</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Decide por datos:</strong> {labelFor(DATA_DRIVEN_OPTIONS, diagnostic.data_driven)}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Fechas próximas:</strong> {diagnostic.upcoming_dates || '—'}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Motivación:</strong> {diagnostic.motivation || '—'}</p>
          {diagnostic.extra_notes && (
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-2)' }}><strong style={{ color: 'var(--fg)' }}>Notas:</strong> {diagnostic.extra_notes}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Modo edición ──
  return (
    <div className="card-glass card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="number-label">{diagnostic ? 'Editar diagnóstico' : 'Nuevo diagnóstico'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => { setEditing(false); setForm(diagnostic ? toForm(diagnostic) : emptyForm(clientId)); }}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Guardando...' : 'Guardar diagnóstico'}
          </button>
        </div>
      </div>

      {error && <p className="empty-note" style={{ color: 'var(--danger)' }}>{error}</p>}

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>01 · Objetivo y expectativas</div>
        <div className="form-field">
          <label>Objetivo principal</label>
          <input className="form-input" value={form.main_objective ?? ''} onChange={(e) => setField('main_objective', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Qué espera en 3 meses</label>
          <input className="form-input" value={form.expected_3_months ?? ''} onChange={(e) => setField('expected_3_months', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Contacto de la empresa</label>
          <input className="form-input" value={form.company_contact ?? ''} onChange={(e) => setField('company_contact', e.target.value)} />
        </div>
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>02 · Ventas y ticket promedio</div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Ventas mensuales promedio (COP)</label>
            <input className="form-input" type="number" min={0} value={form.avg_monthly_sales_cop ?? ''} onChange={(e) => setField('avg_monthly_sales_cop', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="form-field">
            <label>Ticket promedio (COP)</label>
            <input className="form-input" type="number" min={0} value={form.avg_ticket_cop ?? ''} onChange={(e) => setField('avg_ticket_cop', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Ventas diarias promedio (COP)</label>
            <input className="form-input" type="number" min={0} value={form.avg_daily_sales ?? ''} onChange={(e) => setField('avg_daily_sales', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="form-field">
            <label>Margen promedio</label>
            <input className="form-input" value={form.avg_margin ?? ''} onChange={(e) => setField('avg_margin', e.target.value)} placeholder="Ej. 30%" />
          </div>
        </div>
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>03 · Inversión en pauta</div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Rango de inversión mensual</label>
            <select className="form-input" value={form.ad_budget_range ?? ''} onChange={(e) => setField('ad_budget_range', (e.target.value || null) as ClientDiagnosticInput['ad_budget_range'])}>
              <option value="">Selecciona...</option>
              {AD_BUDGET_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>¿Dispuesto a escalar presupuesto?</label>
            <select className="form-input" value={form.willing_to_scale ?? ''} onChange={(e) => setField('willing_to_scale', (e.target.value || null) as ClientDiagnosticInput['willing_to_scale'])}>
              <option value="">Selecciona...</option>
              {WILLING_TO_SCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>¿Ha pautado antes?</label>
          <select className="form-input" value={form.prior_advertising ?? ''} onChange={(e) => setField('prior_advertising', (e.target.value || null) as ClientDiagnosticInput['prior_advertising'])}>
            <option value="">Selecciona...</option>
            {PRIOR_ADVERTISING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Dónde ha pautado</label>
            <input className="form-input" value={form.prior_platforms ?? ''} onChange={(e) => setField('prior_platforms', e.target.value)} placeholder="Meta, TikTok, Google..." />
          </div>
          <div className="form-field">
            <label>Tiempo en el mercado (meses)</label>
            <input className="form-input" type="number" min={0} value={form.months_in_market ?? ''} onChange={(e) => setField('months_in_market', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <div className="form-field">
          <label>En qué invirtieron antes</label>
          <input className="form-input" value={form.prior_ad_spend_notes ?? ''} onChange={(e) => setField('prior_ad_spend_notes', e.target.value)} />
        </div>
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>04 · Área comercial</div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Equipo de ventas</label>
            <select className="form-input" value={form.sales_team ?? ''} onChange={(e) => setField('sales_team', (e.target.value || null) as ClientDiagnosticInput['sales_team'])}>
              <option value="">Selecciona...</option>
              {SALES_TEAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Tiempo de respuesta</label>
            <select className="form-input" value={form.response_time ?? ''} onChange={(e) => setField('response_time', (e.target.value || null) as ClientDiagnosticInput['response_time'])}>
              <option value="">Selecciona...</option>
              {RESPONSE_TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>Canales de atención</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIAGNOSTIC_SERVICE_CHANNELS.map((c) => {
              const selected = form.service_channels.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleChannel(c)}
                  className="status-pill"
                  style={{
                    cursor: 'pointer',
                    background: selected ? 'var(--cyan-dim)' : 'var(--surface-3)',
                    color: selected ? 'var(--cyan)' : 'var(--fg-muted)',
                    border: selected ? '1px solid var(--cyan-border)' : '1px solid var(--border)',
                  }}
                >
                  {SERVICE_CHANNEL_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>05 · Contenido</div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Quién crea el contenido</label>
            <select className="form-input" value={form.content_creator ?? ''} onChange={(e) => setField('content_creator', (e.target.value || null) as ClientDiagnosticInput['content_creator'])}>
              <option value="">Selecciona...</option>
              {CONTENT_CREATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Piezas por mes</label>
            <input className="form-input" type="number" min={0} value={form.content_pieces_per_month ?? ''} onChange={(e) => setField('content_pieces_per_month', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <div className="form-field">
          <label>Material audiovisual</label>
          <select className="form-input" value={form.audiovisual_material ?? ''} onChange={(e) => setField('audiovisual_material', (e.target.value || null) as ClientDiagnosticInput['audiovisual_material'])}>
            <option value="">Selecciona...</option>
            {AUDIOVISUAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>06 · Operación y capacidad</div>
        <div className="form-row-2">
          <div className="form-field">
            <label>Capacidad operativa</label>
            <select className="form-input" value={form.operational_capacity ?? ''} onChange={(e) => setField('operational_capacity', (e.target.value || null) as ClientDiagnosticInput['operational_capacity'])}>
              <option value="">Selecciona...</option>
              {OPERATIONAL_CAPACITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Canal principal de ventas</label>
            <select className="form-input" value={form.top_sales_channel ?? ''} onChange={(e) => setField('top_sales_channel', (e.target.value || null) as ClientDiagnosticInput['top_sales_channel'])}>
              <option value="">Selecciona...</option>
              {TOP_SALES_CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {form.top_sales_channel === 'otro' && (
          <div className="form-field">
            <label>¿Cuál?</label>
            <input className="form-input" value={form.top_sales_channel_other ?? ''} onChange={(e) => setField('top_sales_channel_other', e.target.value)} />
          </div>
        )}
      </section>

      <section>
        <div className="number-label" style={{ marginBottom: 10 }}>07 · Ajuste y compromiso</div>
        <div className="form-field">
          <label>¿Decide con datos?</label>
          <select className="form-input" value={form.data_driven ?? ''} onChange={(e) => setField('data_driven', (e.target.value || null) as ClientDiagnosticInput['data_driven'])}>
            <option value="">Selecciona...</option>
            {DATA_DRIVEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Fechas importantes próximos 3 meses</label>
          <input className="form-input" value={form.upcoming_dates ?? ''} onChange={(e) => setField('upcoming_dates', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Motivación</label>
          <input className="form-input" value={form.motivation ?? ''} onChange={(e) => setField('motivation', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Notas adicionales</label>
          <textarea className="form-input" rows={3} value={form.extra_notes ?? ''} onChange={(e) => setField('extra_notes', e.target.value)} />
        </div>
      </section>
    </div>
  );
}
