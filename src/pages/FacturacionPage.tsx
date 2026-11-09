import { useEffect, useMemo, useState } from 'react';
import { useClients } from '../hooks/useClients';
import { listClientBilling, upsertClientBilling } from '../services/billing';
import { updateClientAdBudget } from '../services/clients';
import type { BillingPaymentStatus, ClientBilling } from '../lib/supabase';
import { formatCopExact } from '../lib/utils';

const PAYMENT_STATUS_OPTIONS: Array<{ value: BillingPaymentStatus; label: string }> = [
  { value: 'al_dia', label: 'Al día' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'pausado', label: 'Pausado' },
];

function paymentStatusStyle(status: BillingPaymentStatus): React.CSSProperties {
  switch (status) {
    case 'al_dia':
      return { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' };
    case 'pendiente':
      return { background: 'var(--warning-dim)', color: 'var(--warning)', border: '1px solid var(--warning)' };
    case 'vencido':
      return { background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)' };
    case 'pausado':
      return { background: 'var(--surface-3)', color: 'var(--fg-muted)', border: '1px solid var(--border)' };
  }
}

// Fila editable local — separa lo que está en client_billing de
// monthly_ad_budget, que vive en clients (ver migración). Un solo "Guardar"
// por fila persiste ambas tablas.
type EditableRow = {
  client_id: string;
  monthly_fee: string;
  monthly_ad_budget: string;
  payment_status: BillingPaymentStatus;
  billing_day: string;
  contract_start: string;
  contract_end: string;
  includes_ad_spend: boolean;
  notes: string;
};

function toEditableRow(clientId: string, budget: number | null | undefined, billing?: ClientBilling): EditableRow {
  return {
    client_id: clientId,
    monthly_fee: billing?.monthly_fee != null ? String(billing.monthly_fee) : '',
    monthly_ad_budget: budget != null ? String(budget) : '',
    payment_status: billing?.payment_status ?? 'al_dia',
    billing_day: billing?.billing_day != null ? String(billing.billing_day) : '',
    contract_start: billing?.contract_start ?? '',
    contract_end: billing?.contract_end ?? '',
    includes_ad_spend: billing?.includes_ad_spend ?? false,
    notes: billing?.notes ?? '',
  };
}

export function FacturacionPage() {
  const { clients, loading: loadingClients } = useClients();
  const [billingByClient, setBillingByClient] = useState<Map<string, ClientBilling>>(new Map());
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [rows, setRows] = useState<Map<string, EditableRow>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorByClient, setErrorByClient] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingBilling(true);
      const data = await listClientBilling();
      if (cancelled) return;
      setBillingByClient(new Map(data.map((b) => [b.client_id, b])));
      setLoadingBilling(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeClients = useMemo(
    () => clients.filter((c) => c.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  // Inicializa las filas editables cuando llegan clientes/facturación, sin
  // pisar ediciones en curso del usuario.
  useEffect(() => {
    setRows((current) => {
      const next = new Map(current);
      for (const client of activeClients) {
        if (!next.has(client.id)) {
          next.set(client.id, toEditableRow(client.id, client.monthly_ad_budget, billingByClient.get(client.id)));
        }
      }
      return next;
    });
  }, [activeClients, billingByClient]);

  const totals = useMemo(() => {
    let monthlyRevenue = 0;
    let adSpendUnderManagement = 0;
    let feesDefined = 0;
    let feesPending = 0;

    for (const client of activeClients) {
      const billing = billingByClient.get(client.id);
      if (billing?.monthly_fee != null) {
        monthlyRevenue += billing.monthly_fee;
        feesDefined += 1;
      } else {
        feesPending += 1;
      }
      if (client.monthly_ad_budget != null) adSpendUnderManagement += client.monthly_ad_budget;
    }

    return {
      monthlyRevenue,
      adSpendUnderManagement,
      avgFee: feesDefined > 0 ? monthlyRevenue / feesDefined : null,
      feesPending,
    };
  }, [activeClients, billingByClient]);

  function updateRow(clientId: string, patch: Partial<EditableRow>) {
    setRows((current) => {
      const next = new Map(current);
      const existing = next.get(clientId);
      if (existing) next.set(clientId, { ...existing, ...patch });
      return next;
    });
  }

  async function handleSave(clientId: string) {
    const row = rows.get(clientId);
    if (!row) return;

    setSavingId(clientId);
    setErrorByClient((current) => {
      const next = new Map(current);
      next.delete(clientId);
      return next;
    });

    const billingResult = await upsertClientBilling({
      client_id: clientId,
      monthly_fee: row.monthly_fee.trim() ? Number(row.monthly_fee) : null,
      currency: 'COP',
      billing_day: row.billing_day.trim() ? Number(row.billing_day) : null,
      contract_start: row.contract_start.trim() || null,
      contract_end: row.contract_end.trim() || null,
      payment_status: row.payment_status,
      includes_ad_spend: row.includes_ad_spend,
      notes: row.notes.trim() || null,
    });

    if (billingResult.error) {
      setErrorByClient((current) => new Map(current).set(clientId, billingResult.error as string));
      setSavingId(null);
      return;
    }

    const budgetResult = await updateClientAdBudget(
      clientId,
      row.monthly_ad_budget.trim() ? Number(row.monthly_ad_budget) : null,
    );

    if (budgetResult.error) {
      setErrorByClient((current) => new Map(current).set(clientId, budgetResult.error as string));
      setSavingId(null);
      return;
    }

    if (billingResult.data) {
      setBillingByClient((current) => new Map(current).set(clientId, billingResult.data as ClientBilling));
    }
    setSavingId(null);
  }

  const loading = loadingClients || loadingBilling;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación</h1>
          <p className="page-subtitle">Honorarios y presupuesto de pauta · solo visible para admins</p>
        </div>
      </div>

      <div className="portal-kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Ingresos mensuales agencia', value: formatCopExact(totals.monthlyRevenue), sub: 'suma de fees definidos' },
          { label: 'Inversión en pauta bajo gestión', value: formatCopExact(totals.adSpendUnderManagement), sub: `presupuesto mensual, ${activeClients.length} cliente${activeClients.length === 1 ? '' : 's'} activo${activeClients.length === 1 ? '' : 's'}` },
          { label: 'Fee promedio', value: totals.avgFee != null ? formatCopExact(totals.avgFee) : '—', sub: 'solo clientes con fee definido' },
          { label: 'Fees pendientes por definir', value: String(totals.feesPending), sub: 'de ' + activeClients.length + ' activos' },
        ].map((card) => (
          <div key={card.label} className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">{card.label}</p>
            <p className="portal-kpi-value">{card.value}</p>
            <p className="portal-kpi-sub">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="card-glass" style={{ margin: '0 24px 24px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
            Cargando facturación...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 1180, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente', 'Fee mensual (COP)', 'Presupuesto pauta (COP)', 'Estado pago', 'Día cobro', 'Inicio', 'Fin', 'Incluye pauta', 'Notas', ''].map((h) => (
                    <th
                      key={h}
                      className="number-label"
                      style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap', fontSize: '0.6rem', color: 'var(--fg-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeClients.map((client) => {
                  const row = rows.get(client.id);
                  if (!row) return null;
                  const rowError = errorByClient.get(client.id);

                  return (
                    <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                        {client.name}
                        {rowError && (
                          <p style={{ margin: '4px 0 0', fontSize: '0.64rem', color: 'var(--danger)', whiteSpace: 'normal', maxWidth: 180 }}>
                            {rowError}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={row.monthly_fee}
                          onChange={(e) => updateRow(client.id, { monthly_fee: e.target.value })}
                          placeholder="—"
                          style={{ width: 130 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={row.monthly_ad_budget}
                          onChange={(e) => updateRow(client.id, { monthly_ad_budget: e.target.value })}
                          placeholder="—"
                          style={{ width: 130 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <select
                          className="form-input"
                          value={row.payment_status}
                          onChange={(e) => updateRow(client.id, { payment_status: e.target.value as BillingPaymentStatus })}
                          style={{ width: 120 }}
                        >
                          {PAYMENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <span
                          className="status-pill"
                          style={{ ...paymentStatusStyle(row.payment_status), marginLeft: 6, fontSize: '0.56rem' }}
                        >
                          {PAYMENT_STATUS_OPTIONS.find((o) => o.value === row.payment_status)?.label}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          type="number"
                          min={1}
                          max={31}
                          value={row.billing_day}
                          onChange={(e) => updateRow(client.id, { billing_day: e.target.value })}
                          placeholder="—"
                          style={{ width: 64 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          type="date"
                          value={row.contract_start}
                          onChange={(e) => updateRow(client.id, { contract_start: e.target.value })}
                          style={{ width: 140 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          type="date"
                          value={row.contract_end}
                          onChange={(e) => updateRow(client.id, { contract_end: e.target.value })}
                          style={{ width: 140 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row.includes_ad_spend}
                          onChange={(e) => updateRow(client.id, { includes_ad_spend: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          value={row.notes}
                          onChange={(e) => updateRow(client.id, { notes: e.target.value })}
                          placeholder="Notas"
                          style={{ width: 160 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <button
                          className="btn-secondary"
                          disabled={savingId === client.id}
                          onClick={() => void handleSave(client.id)}
                        >
                          {savingId === client.id ? 'Guardando...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
