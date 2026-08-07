import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ImageIcon, Lock, ShoppingBag, Unlock, Video } from 'lucide-react';
import { GlassCard } from '../components/ui-custom/GlassCard';
import { PrimaryButton } from '../components/ui-custom/PrimaryButton';
import { listAdCampaignMetrics } from '../services/adCampaignMetrics';
import {
  listPublicPortalCreativeAssets,
  listPublicPortalDailyEntries,
  resolvePortalSlug,
  savePortalDailyEntry,
  savePortalSale,
  validatePortalPin,
  type PortalResolveResult,
} from '../services/portal';
import {
  PORTAL_OBJECTION_OPTIONS,
  PORTAL_VISIT_OPTIONS,
  type AdCampaignMetric,
  type PortalCreativeAsset,
  type PortalDailyEntry,
  type PortalObjection,
  type PortalVisitStatus,
} from '../lib/supabase';
import { formatCop } from '../lib/utils';

const DAYS_OF_WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthGrid(monthDate: Date): Array<{ key: string; day: number; inMonth: boolean }> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first grid offset
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return { key: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

type EntryState = {
  citas: number;
  compras: number;
  objecion: PortalObjection | null;
  visita_punto_fisico: PortalVisitStatus | null;
};

function entryStateFrom(entry: PortalDailyEntry | undefined): EntryState {
  return {
    citas: entry?.citas ?? 0,
    compras: entry?.compras ?? 0,
    objecion: entry?.objecion ?? null,
    visita_punto_fisico: entry?.visita_punto_fisico ?? null,
  };
}

export function ClientPortalPublicPage() {
  const { slug } = useParams<{ slug: string }>();

  const [status, setStatus] = useState<'loading' | 'invalid' | 'error' | 'ready'>('loading');
  const [portal, setPortal] = useState<PortalResolveResult | null>(null);
  const [campaignRows, setCampaignRows] = useState<AdCampaignMetric[]>([]);
  const [creativeAssets, setCreativeAssets] = useState<PortalCreativeAsset[]>([]);
  const [dailyEntries, setDailyEntries] = useState<PortalDailyEntry[]>([]);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  const [pinRegistro, setPinRegistro] = useState('');
  const [pinRegistroInput, setPinRegistroInput] = useState('');
  const [pinRegistroError, setPinRegistroError] = useState('');
  const [pinVentas, setPinVentas] = useState('');
  const [pinVentasInput, setPinVentasInput] = useState('');
  const [pinVentasError, setPinVentasError] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [lastSavedAmount, setLastSavedAmount] = useState<number | null>(null);

  const [entriesState, setEntriesState] = useState<Record<string, EntryState>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Load portal + data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setPinRegistro(sessionStorage.getItem(`portal:${slug}:pin_registro`) ?? '');
    setPinVentas(sessionStorage.getItem(`portal:${slug}:pin_ventas`) ?? '');

    resolvePortalSlug(slug).then(async (result) => {
      if (result.error || !result.data) {
        // A 404 means the slug genuinely doesn't exist or the portal is disabled.
        // Anything else (500, network failure, etc.) is a real bug, not a bad link —
        // must not look the same to the visitor.
        setStatus(result.status === 404 ? 'invalid' : 'error');
        return;
      }
      setPortal(result.data);
      const [campaigns, assets, entries] = await Promise.all([
        listAdCampaignMetrics({ clientId: result.data.client_id, days: 180 }),
        listPublicPortalCreativeAssets(result.data.client_id),
        listPublicPortalDailyEntries(result.data.client_id),
      ]);
      setCampaignRows(campaigns);
      setCreativeAssets(assets);
      setDailyEntries(entries);

      const lastDate = campaigns.length > 0 ? [...campaigns].sort((a, b) => b.date.localeCompare(a.date))[0].date : null;
      if (lastDate) {
        setSelectedDate(lastDate);
        setMonthDate(new Date(`${lastDate}T00:00:00`));
      }
      setStatus('ready');
    });
  }, [slug]);

  // ── Calendar ─────────────────────────────────────────────────────────────────
  const campaignCountByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    campaignRows.forEach((r) => {
      if (r.spend <= 0) return;
      const set = map.get(r.date) ?? new Set<string>();
      set.add(r.campaign_id);
      map.set(r.date, set);
    });
    return new Map([...map.entries()].map(([k, v]) => [k, v.size]));
  }, [campaignRows]);

  const maxCampaignCount = Math.max(1, ...campaignCountByDate.values());
  const gridDays = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  // ── Selected day rows ────────────────────────────────────────────────────────
  const dayRows = useMemo(
    () => campaignRows.filter((r) => r.date === selectedDate && r.spend > 0),
    [campaignRows, selectedDate],
  );

  const assetByCampaignName = useMemo(
    () => new Map(creativeAssets.map((a) => [a.campaign_name, a])),
    [creativeAssets],
  );

  useEffect(() => {
    const next: Record<string, EntryState> = {};
    dayRows.forEach((row) => {
      const entry = dailyEntries.find((e) => e.date === selectedDate && e.campaign_id === row.campaign_id);
      next[row.campaign_id] = entryStateFrom(entry);
    });
    setEntriesState(next);
  }, [selectedDate, dayRows, dailyEntries]);

  const unlockedRegistro = pinRegistro.length === 4;
  const unlockedVentas = pinVentas.length === 4;

  const handleUnlockRegistro = async () => {
    if (!slug) return;
    setPinRegistroError('');
    const result = await validatePortalPin(slug, pinRegistroInput, 'registro');
    if (result.data?.valid) {
      sessionStorage.setItem(`portal:${slug}:pin_registro`, pinRegistroInput);
      setPinRegistro(pinRegistroInput);
    } else {
      setPinRegistroError('PIN incorrecto.');
    }
  };

  const handleUnlockVentas = async () => {
    if (!slug) return;
    setPinVentasError('');
    const result = await validatePortalPin(slug, pinVentasInput, 'ventas');
    if (result.data?.valid) {
      sessionStorage.setItem(`portal:${slug}:pin_ventas`, pinVentasInput);
      setPinVentas(pinVentasInput);
    } else {
      setPinVentasError('PIN incorrecto.');
    }
  };

  const scheduleSave = (campaignId: string, next: EntryState) => {
    if (!slug || !portal) return;
    const timerKey = campaignId;
    if (debounceTimers.current[timerKey]) clearTimeout(debounceTimers.current[timerKey]);
    debounceTimers.current[timerKey] = setTimeout(() => {
      void savePortalDailyEntry({
        slug,
        pin: pinRegistro,
        client_id: portal.client_id,
        date: selectedDate,
        campaign_id: campaignId,
        citas: next.citas,
        compras: next.compras,
        objecion: next.objecion,
        visita_punto_fisico: next.visita_punto_fisico,
      }).then((result) => {
        if (result.data) {
          setDailyEntries((prev) => [
            ...prev.filter((e) => !(e.date === selectedDate && e.campaign_id === campaignId)),
            result.data as PortalDailyEntry,
          ]);
        }
      });
    }, 800);
  };

  const updateEntry = (campaignId: string, patch: Partial<EntryState>) => {
    setEntriesState((prev) => {
      const next = { ...(prev[campaignId] ?? entryStateFrom(undefined)), ...patch };
      scheduleSave(campaignId, next);
      return { ...prev, [campaignId]: next };
    });
  };

  const handleRegisterSale = async () => {
    if (!slug || !portal) return;
    const amount = Number(saleAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSavingSale(true);
    setLastSavedAmount(null);
    const result = await savePortalSale({
      slug,
      pin: pinVentas,
      client_id: portal.client_id,
      date: toDateKey(new Date()),
      total_sales: amount,
    });
    setSavingSale(false);
    if (result.data) {
      setLastSavedAmount(amount);
      setSaleAmount('');
    } else if (result.error) {
      alert(result.error);
    }
  };

  // ── Summary by conjunto_label ────────────────────────────────────────────────
  const summaryRows = useMemo(() => {
    const campaignNameToConjunto = new Map(
      creativeAssets.map((a) => [a.campaign_name, a.conjunto_label?.trim() || 'Sin conjunto asignado']),
    );
    const campaignIdToName = new Map(campaignRows.map((r) => [r.campaign_id, r.campaign_name]));

    const map = new Map<string, { conjunto: string; mensajes: number; citas: number; compras: number }>();
    const getRow = (conjunto: string) => {
      const existing = map.get(conjunto);
      if (existing) return existing;
      const created = { conjunto, mensajes: 0, citas: 0, compras: 0 };
      map.set(conjunto, created);
      return created;
    };

    campaignRows.forEach((r) => {
      const conjunto = campaignNameToConjunto.get(r.campaign_name) ?? 'Sin conjunto asignado';
      getRow(conjunto).mensajes += r.messages ?? 0;
    });

    dailyEntries.forEach((e) => {
      const name = campaignIdToName.get(e.campaign_id);
      const conjunto = (name && campaignNameToConjunto.get(name)) ?? 'Sin conjunto asignado';
      const row = getRow(conjunto);
      row.citas += e.citas;
      row.compras += e.compras;
    });

    return [...map.values()].sort((a, b) => b.mensajes - a.mensajes);
  }, [campaignRows, dailyEntries, creativeAssets]);

  const summaryTotals = summaryRows.reduce(
    (acc, r) => ({ mensajes: acc.mensajes + r.mensajes, citas: acc.citas + r.citas, compras: acc.compras + r.compras }),
    { mensajes: 0, citas: 0, compras: 0 },
  );

  // ── Render states ────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>Cargando…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--fg)' }}>Hubo un problema cargando esta página</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            Intenta de nuevo en unos minutos. Si el problema sigue, avisa a tu agencia.
          </p>
        </GlassCard>
      </div>
    );
  }

  if (status === 'invalid' || !portal) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <GlassCard style={{ padding: 32, textAlign: 'center', maxWidth: 380 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--fg)' }}>Enlace no válido o inactivo</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
            Verifica el link con tu agencia o solicita uno nuevo.
          </p>
        </GlassCard>
      </div>
    );
  }

  const initial = portal.name.charAt(0).toUpperCase();

  return (
    <div className="page-content" style={{ maxWidth: 920, margin: '0 auto', paddingBottom: 48 }}>
      {/* ── 1. Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '28px 24px 20px' }}>
        {portal.logo_url ? (
          <img src={portal.logo_url} alt={portal.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)' }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--cyan-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 700, color: 'var(--cyan)',
          }}>
            {initial}
          </div>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            {portal.name}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>
            Panel de resultados
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 24px' }}>
        {/* ── 2. Calendario mensual ── */}
        <GlassCard style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button className="btn-secondary" style={{ padding: 6 }} onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg)' }}>{monthLabel(monthDate)}</span>
            <button className="btn-secondary" style={{ padding: 6 }} onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {DAYS_OF_WEEK.map((d) => (
              <span key={d} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {gridDays.map(({ key, day, inMonth }) => {
              const count = campaignCountByDate.get(key) ?? 0;
              const intensity = count > 0 ? 0.15 + 0.55 * (count / maxCampaignCount) : 0;
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  style={{
                    aspectRatio: '1', borderRadius: 8, border: isSelected ? '2px solid var(--cyan)' : '1px solid var(--border)',
                    background: count > 0 ? `oklch(0.72 0.15 200 / ${intensity})` : 'var(--surface-2)',
                    opacity: inMonth ? 1 : 0.35, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    color: 'var(--fg)', fontSize: '0.72rem',
                  }}
                >
                  <span>{day}</span>
                  {count > 0 && <span style={{ fontSize: '0.55rem', color: 'var(--fg-muted)' }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* ── 3. Registro del día seleccionado ── */}
        <GlassCard style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)' }}>
              Registro — {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
            </span>
          </div>

          {!unlockedRegistro && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
              background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', marginBottom: 14, flexWrap: 'wrap',
            }}>
              <Lock size={14} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--fg)' }}>Ingresa el PIN para editar</span>
              <input
                className="form-input"
                value={pinRegistroInput}
                maxLength={4}
                inputMode="numeric"
                placeholder="0000"
                onChange={(e) => setPinRegistroInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ width: 90, padding: '6px 10px', fontFamily: 'JetBrains Mono' }}
              />
              <PrimaryButton size="sm" onClick={handleUnlockRegistro} disabled={pinRegistroInput.length !== 4}>
                Desbloquear
              </PrimaryButton>
              {pinRegistroError && <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{pinRegistroError}</span>}
            </div>
          )}

          {dayRows.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>No hay anuncios activos este día.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dayRows.map((row) => {
                const asset = assetByCampaignName.get(row.campaign_name);
                const entry = entriesState[row.campaign_id] ?? entryStateFrom(undefined);
                return (
                  <div key={row.campaign_id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {asset?.asset_type === 'video' ? (
                        <Video size={16} style={{ color: 'var(--fg-muted)' }} />
                      ) : asset?.asset_url ? (
                        <img src={asset.asset_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={16} style={{ color: 'var(--fg-muted)' }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.campaign_name}
                        </span>
                        {asset?.conjunto_label && (
                          <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
                            {asset.conjunto_label}
                          </span>
                        )}
                        <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 4, background: 'var(--cyan-dim)', color: 'var(--cyan)' }}>
                          {row.messages} msgs
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(90px, 1fr))', gap: 8, marginTop: 8 }}>
                        <div>
                          <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 3 }}>Citas</span>
                          <input
                            className="form-input" type="number" min={0} disabled={!unlockedRegistro}
                            value={entry.citas}
                            onChange={(e) => updateEntry(row.campaign_id, { citas: Math.max(0, Number(e.target.value) || 0) })}
                            style={{ padding: '6px 8px', fontSize: '0.76rem' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 3 }}>Compras</span>
                          <input
                            className="form-input" type="number" min={0} disabled={!unlockedRegistro}
                            value={entry.compras}
                            onChange={(e) => updateEntry(row.campaign_id, { compras: Math.max(0, Number(e.target.value) || 0) })}
                            style={{ padding: '6px 8px', fontSize: '0.76rem' }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 3 }}>Objeción</span>
                          <select
                            className="form-input" disabled={!unlockedRegistro}
                            value={entry.objecion ?? ''}
                            onChange={(e) => updateEntry(row.campaign_id, { objecion: (e.target.value || null) as PortalObjection | null })}
                            style={{ padding: '6px 8px', fontSize: '0.72rem' }}
                          >
                            <option value="">—</option>
                            {PORTAL_OBJECTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 3 }}>Visita punto físico</span>
                          <select
                            className="form-input" disabled={!unlockedRegistro}
                            value={entry.visita_punto_fisico ?? ''}
                            onChange={(e) => updateEntry(row.campaign_id, { visita_punto_fisico: (e.target.value || null) as PortalVisitStatus | null })}
                            style={{ padding: '6px 8px', fontSize: '0.72rem' }}
                          >
                            <option value="">—</option>
                            {PORTAL_VISIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* ── 4. Resumen de efectividad ── */}
        <GlassCard style={{ padding: 20 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: 14 }}>
            Resumen de efectividad
          </span>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Conjunto', 'Mensajes', 'Citas', 'Compras', '% Efectividad'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--fg-muted)', fontWeight: 500, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.conjunto} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--fg)' }}>{r.conjunto}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--fg)' }}>{r.mensajes}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--fg)' }}>{r.citas}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--fg)' }}>{r.compras}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--cyan)' }}>
                      {r.mensajes > 0 ? `${((r.compras / r.mensajes) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '10px', fontWeight: 700, color: 'var(--fg)' }}>Total general</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--fg)' }}>{summaryTotals.mensajes}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--fg)' }}>{summaryTotals.citas}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--fg)' }}>{summaryTotals.compras}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--cyan)' }}>
                    {summaryTotals.mensajes > 0 ? `${((summaryTotals.compras / summaryTotals.mensajes) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* ── 5. Registrar venta de hoy ── */}
        <GlassCard style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShoppingBag size={15} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)' }}>Registrar venta de hoy</span>
          </div>

          {!unlockedVentas ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
              background: 'var(--success-dim)', border: '1px solid var(--success)', flexWrap: 'wrap',
            }}>
              <Lock size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--fg)' }}>Ingresa el PIN de ventas</span>
              <input
                className="form-input"
                value={pinVentasInput}
                maxLength={4}
                inputMode="numeric"
                placeholder="0000"
                onChange={(e) => setPinVentasInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ width: 90, padding: '6px 10px', fontFamily: 'JetBrains Mono' }}
              />
              <PrimaryButton size="sm" onClick={handleUnlockVentas} disabled={pinVentasInput.length !== 4}>
                Desbloquear
              </PrimaryButton>
              {pinVentasError && <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{pinVentasError}</span>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Unlock size={14} style={{ color: 'var(--success)' }} />
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder="Monto de la venta"
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <PrimaryButton onClick={handleRegisterSale} loading={savingSale} disabled={!saleAmount}>
                Registrar
              </PrimaryButton>
              {lastSavedAmount != null && <span style={{ fontSize: '0.76rem', color: 'var(--success)' }}>Guardado {formatCop(lastSavedAmount)}</span>}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
