import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import {
  listClientBilling,
  listClientBillingPayments,
  upsertClientBilling,
  upsertClientBillingPayment,
} from '../services/billing';
import { updateClientAdBudget } from '../services/clients';
import type {
  BillingPaymentFrequency,
  BillingPaymentMonthStatus,
  BillingPaymentPeriod,
  BillingPaymentReceiver,
  Client,
  ClientBilling,
  ClientBillingPayment,
} from '../lib/supabase';
import { formatCopExact } from '../lib/utils';
import { getMonthLabel } from '../utils/monthLabel';

type StatusFilter = 'active' | 'all';
type ReceiverFilter = 'all' | BillingPaymentReceiver;

const RECEIVER_LABELS: Record<BillingPaymentReceiver, string> = {
  samuel: 'Samuel',
  juanca: 'Juanca',
  compartido: 'Compartido',
};

const FREQUENCY_LABELS: Record<BillingPaymentFrequency, string> = {
  anticipado: 'Pago anticipado',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
};

const PERIOD_LABELS: Record<BillingPaymentPeriod, string> = {
  mes: 'Mes completo',
  q1: '1 – 15',
  q2: '16 – 30',
};

// Siempre el 1ro del mes actual en America/Bogota (no la zona del navegador
// ni del servidor) — Colombia no tiene horario de verano, así que un offset
// fijo bastaría, pero Intl con timeZone explícito es más a prueba de fallos.
function getBogotaCurrentMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}-01`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// mensual/anticipado => un solo cobro ('mes'). quincenal => dos ('q1','q2'),
// cada uno por fee/2. Cambiar de modalidad nunca borra pagos ya guardados
// del otro esquema, solo deja de mostrarlos (ver prompt de negocio).
function periodsForFrequency(freq: BillingPaymentFrequency | null | undefined): BillingPaymentPeriod[] {
  return freq === 'quincenal' ? ['q1', 'q2'] : ['mes'];
}

function paymentKey(clientId: string, period: BillingPaymentPeriod): string {
  return `${clientId}:${period}`;
}

// Fila editable local — solo fee + presupuesto de pauta (que vive en
// clients, ver migración original). Un "Guardar" por fila persiste ambas.
type EditableRow = {
  client_id: string;
  monthly_fee: string;
  monthly_ad_budget: string;
};

function toEditableRow(clientId: string, budget: number | null | undefined, billing?: ClientBilling): EditableRow {
  return {
    client_id: clientId,
    monthly_fee: billing?.monthly_fee != null ? String(billing.monthly_fee) : '',
    monthly_ad_budget: budget != null ? String(budget) : '',
  };
}

export function FacturacionPage() {
  const { clients, loading: loadingClients, reload: reloadClients } = useClients();
  const [billingByClient, setBillingByClient] = useState<Map<string, ClientBilling>>(new Map());
  const [payments, setPayments] = useState<ClientBillingPayment[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [rows, setRows] = useState<Map<string, EditableRow>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingPaymentKey, setTogglingPaymentKey] = useState<string | null>(null);
  const [togglingPartnerKey, setTogglingPartnerKey] = useState<string | null>(null);
  const [errorByClient, setErrorByClient] = useState<Map<string, string>>(new Map());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [receiverFilter, setReceiverFilter] = useState<ReceiverFilter>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getBogotaCurrentMonth());
  const [updatingFieldId, setUpdatingFieldId] = useState<string | null>(null);
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());

  async function loadBilling() {
    setLoadingBilling(true);
    const [billing, pays] = await Promise.all([listClientBilling(), listClientBillingPayments()]);
    setBillingByClient(new Map(billing.map((b) => [b.client_id, b])));
    setPayments(pays);
    setLoadingBilling(false);
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  const visibleClients = useMemo(
    () =>
      clients
        .filter((c) => statusFilter === 'all' || c.status === 'active')
        .filter((c) => receiverFilter === 'all' || billingByClient.get(c.id)?.payment_receiver === receiverFilter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients, statusFilter, receiverFilter, billingByClient],
  );

  // Inicializa las filas editables cuando llegan clientes/facturación, sin
  // pisar ediciones en curso del usuario.
  useEffect(() => {
    setRows((current) => {
      const next = new Map(current);
      for (const client of visibleClients) {
        if (!next.has(client.id)) {
          next.set(client.id, toEditableRow(client.id, client.monthly_ad_budget, billingByClient.get(client.id)));
        }
      }
      return next;
    });
  }, [visibleClients, billingByClient]);

  const paymentByClientPeriod = useMemo(() => {
    const map = new Map<string, ClientBillingPayment>();
    for (const p of payments) {
      if (p.month.slice(0, 10) === selectedMonth) map.set(paymentKey(p.client_id, p.period), p);
    }
    return map;
  }, [payments, selectedMonth]);

  function paymentFor(clientId: string, period: BillingPaymentPeriod) {
    return paymentByClientPeriod.get(paymentKey(clientId, period));
  }

  // Totales del mes. "El socio" = Juanca, visto desde esta app (de Samuel):
  // si el receptor es 'juanca' el 100% del cobro es su parte a reenviar; si
  // es 'compartido', la mitad; si es 'samuel' (o sin receptor), nada. Sin
  // una columna de "quién cobra" por cliente en la BD no hay forma de saber
  // el caso real de cada cliente, así que esta es la convención usada.
  const totals = useMemo(() => {
    let feeExpected = 0;
    let collected = 0;
    let pending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let feeUndefined = 0;
    let adSpendUnderManagement = 0;
    let receiverUnassigned = 0;
    let partnerPending = 0;
    const byReceiver: Record<BillingPaymentReceiver, { expected: number; collected: number }> = {
      samuel: { expected: 0, collected: 0 },
      juanca: { expected: 0, collected: 0 },
      compartido: { expected: 0, collected: 0 },
    };

    for (const client of visibleClients) {
      const billing = billingByClient.get(client.id);
      const fee = billing?.monthly_fee;
      if (client.monthly_ad_budget != null) adSpendUnderManagement += client.monthly_ad_budget;

      if (fee == null) {
        feeUndefined += 1;
        continue;
      }

      const receiver = billing?.payment_receiver ?? null;
      if (!receiver) receiverUnassigned += 1;

      const periods = periodsForFrequency(billing?.payment_frequency);
      const periodAmount = periods.length === 2 ? fee / 2 : fee;

      for (const period of periods) {
        feeExpected += periodAmount;
        const payment = paymentFor(client.id, period);
        const isPaid = payment?.status === 'pagado';

        if (isPaid) {
          collected += periodAmount;
          paidCount += 1;
        } else {
          pending += periodAmount;
          pendingCount += 1;
        }

        if (receiver === 'samuel') {
          byReceiver.samuel.expected += periodAmount;
          if (isPaid) byReceiver.samuel.collected += periodAmount;
        } else if (receiver === 'juanca') {
          byReceiver.juanca.expected += periodAmount;
          if (isPaid) byReceiver.juanca.collected += periodAmount;
        } else if (receiver === 'compartido') {
          byReceiver.compartido.expected += periodAmount;
          byReceiver.samuel.expected += periodAmount / 2;
          byReceiver.juanca.expected += periodAmount / 2;
          if (isPaid) {
            byReceiver.compartido.collected += periodAmount;
            byReceiver.samuel.collected += periodAmount / 2;
            byReceiver.juanca.collected += periodAmount / 2;
          }
        }

        const partnerShare = receiver === 'juanca' ? periodAmount : receiver === 'compartido' ? periodAmount / 2 : 0;
        if (isPaid && partnerShare > 0 && !payment?.partner_paid) {
          partnerPending += partnerShare;
        }
      }
    }

    return {
      feeExpected,
      collected,
      pending,
      paidCount,
      pendingCount,
      feeUndefined,
      adSpendUnderManagement,
      byReceiver,
      receiverUnassigned,
      partnerPending,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleClients, billingByClient, paymentByClientPeriod]);

  function updateRow(clientId: string, patch: Partial<EditableRow>) {
    setRows((current) => {
      const next = new Map(current);
      const existing = next.get(clientId);
      if (existing) next.set(clientId, { ...existing, ...patch });
      return next;
    });
  }

  function setRowError(clientId: string, message: string | null) {
    setErrorByClient((current) => {
      const next = new Map(current);
      if (message) next.set(clientId, message);
      else next.delete(clientId);
      return next;
    });
  }

  function toggleExpanded(clientId: string) {
    setExpandedClientIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  async function handleSave(clientId: string) {
    const row = rows.get(clientId);
    if (!row) return;

    setSavingId(clientId);
    setRowError(clientId, null);

    const billingResult = await upsertClientBilling({
      client_id: clientId,
      monthly_fee: row.monthly_fee.trim() ? Number(row.monthly_fee) : null,
      currency: 'COP',
    });

    if (billingResult.error) {
      setRowError(clientId, billingResult.error);
      setSavingId(null);
      return;
    }

    const budgetResult = await updateClientAdBudget(
      clientId,
      row.monthly_ad_budget.trim() ? Number(row.monthly_ad_budget) : null,
    );

    if (budgetResult.error) {
      setRowError(clientId, budgetResult.error);
      setSavingId(null);
      return;
    }

    if (billingResult.data) {
      setBillingByClient((current) => new Map(current).set(clientId, billingResult.data as ClientBilling));
    }
    await reloadClients();
    setSavingId(null);
  }

  // Guardado inmediato al cambiar receptor/modalidad — no espera al botón
  // "Guardar" de la fila (ese sigue siendo solo para fee/presupuesto).
  async function handleUpdateBillingField(
    clientId: string,
    patch: { payment_receiver?: BillingPaymentReceiver | null; payment_frequency?: BillingPaymentFrequency | null },
  ) {
    const existing = billingByClient.get(clientId);
    setUpdatingFieldId(clientId);
    setRowError(clientId, null);

    const result = await upsertClientBilling({
      client_id: clientId,
      monthly_fee: existing?.monthly_fee ?? null,
      currency: existing?.currency ?? 'COP',
      payment_receiver: patch.payment_receiver !== undefined ? patch.payment_receiver : existing?.payment_receiver ?? null,
      payment_frequency: patch.payment_frequency !== undefined ? patch.payment_frequency : existing?.payment_frequency ?? null,
    });

    if (result.error) {
      setRowError(clientId, result.error);
    } else if (result.data) {
      setBillingByClient((current) => new Map(current).set(clientId, result.data as ClientBilling));
    }
    setUpdatingFieldId(null);
  }

  function replacePayment(saved: ClientBillingPayment) {
    setPayments((current) => [
      ...current.filter(
        (p) => !(p.client_id === saved.client_id && p.month.slice(0, 10) === selectedMonth && p.period === saved.period),
      ),
      saved,
    ]);
  }

  async function handleTogglePayment(clientId: string, period: BillingPaymentPeriod) {
    const current = paymentFor(clientId, period);
    const next: BillingPaymentMonthStatus = current?.status === 'pagado' ? 'pendiente' : 'pagado';
    const key = paymentKey(clientId, period);
    setTogglingPaymentKey(key);
    setRowError(clientId, null);

    // Al volver a pendiente también se limpia "pagado al socio": si el
    // cliente no ha pagado, no tiene sentido marcar nada como repartido.
    const goingToPending = next === 'pendiente';

    const result = await upsertClientBillingPayment({
      client_id: clientId,
      month: selectedMonth,
      period,
      status: next,
      paid_at: next === 'pagado' ? todayIsoDate() : null,
      partner_paid: goingToPending ? false : current?.partner_paid ?? false,
      partner_paid_at: goingToPending ? null : current?.partner_paid_at ?? null,
    });

    if (result.error) setRowError(clientId, result.error);
    else if (result.data) replacePayment(result.data);
    setTogglingPaymentKey(null);
  }

  async function handleTogglePartnerPaid(clientId: string, period: BillingPaymentPeriod) {
    const current = paymentFor(clientId, period);
    if (!current || current.status !== 'pagado') return;

    const key = paymentKey(clientId, period);
    setTogglingPartnerKey(key);
    setRowError(clientId, null);

    const nextPartnerPaid = !current.partner_paid;
    const result = await upsertClientBillingPayment({
      client_id: clientId,
      month: selectedMonth,
      period,
      status: 'pagado',
      paid_at: current.paid_at,
      partner_paid: nextPartnerPaid,
      partner_paid_at: nextPartnerPaid ? todayIsoDate() : null,
    });

    if (result.error) setRowError(clientId, result.error);
    else if (result.data) replacePayment(result.data);
    setTogglingPartnerKey(null);
  }

  function renderPeriodControl(client: Client, period: BillingPaymentPeriod, billing: ClientBilling | undefined, compact: boolean) {
    const payment = paymentFor(client.id, period);
    const isPaid = payment?.status === 'pagado';
    const key = paymentKey(client.id, period);
    const isToggling = togglingPaymentKey === key;
    const isTogglingPartner = togglingPartnerKey === key;
    const hasReceiver = !!billing?.payment_receiver;

    return (
      <div key={period} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
        {!compact && (
          <span className="meta-chip" style={{ fontSize: '0.56rem', width: 'fit-content' }}>
            {PERIOD_LABELS[period]}
          </span>
        )}
        <button
          className="status-pill"
          disabled={isToggling}
          onClick={() => void handleTogglePayment(client.id, period)}
          title="Click para alternar pagado/pendiente"
          style={{
            cursor: 'pointer',
            display: 'block',
            fontFamily: 'JetBrains Mono',
            background: isPaid ? 'var(--success-dim)' : 'var(--warning-dim)',
            color: isPaid ? 'var(--success)' : 'var(--warning)',
            border: `1px solid ${isPaid ? 'var(--success)' : 'var(--warning)'}`,
          }}
        >
          {isToggling ? 'Guardando...' : isPaid ? 'Pagado' : 'Pendiente'}
        </button>
        {isPaid && payment?.paid_at && (
          <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>{payment.paid_at}</span>
        )}
        {isPaid && (
          <button
            className="btn-ghost"
            disabled={!hasReceiver || isTogglingPartner}
            onClick={() => void handleTogglePartnerPaid(client.id, period)}
            title={hasReceiver ? 'Click para marcar/desmarcar como pasado al socio' : 'Sin receptor asignado — no se puede calcular qué pasarle'}
            style={{
              fontSize: '0.58rem',
              padding: '3px 8px',
              opacity: hasReceiver ? 1 : 0.5,
              cursor: hasReceiver ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            {!hasReceiver
              ? 'Sin receptor'
              : isTogglingPartner
                ? 'Guardando...'
                : payment?.partner_paid
                  ? `Pagado al socio ✓${payment.partner_paid_at ? ` (${payment.partner_paid_at})` : ''}`
                  : 'Pagado al socio'}
          </button>
        )}
      </div>
    );
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            aria-label="Mes anterior"
            style={{ padding: '6px 8px' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span
            className="number-label"
            style={{ fontSize: '0.78rem', color: 'var(--fg)', minWidth: 160, textAlign: 'center' }}
          >
            {getMonthLabel(selectedMonth)}
          </span>
          <button
            className="btn-secondary"
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            aria-label="Mes siguiente"
            style={{ padding: '6px 8px' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            height: '36px',
            padding: '0 12px',
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'JetBrains Mono',
            fontSize: '0.72rem',
            letterSpacing: '0.05em',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="active">Solo activos</option>
          <option value="all">Todos (incluye inactivos)</option>
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          {([
            ['all', 'Todos'],
            ['samuel', 'Samuel'],
            ['juanca', 'Juanca'],
            ['compartido', 'Compartido'],
          ] as [ReceiverFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              className={receiverFilter === value ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setReceiverFilter(value)}
              style={{ padding: '6px 12px', fontSize: '0.68rem' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="portal-kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Fee total esperado', value: formatCopExact(totals.feeExpected), sub: getMonthLabel(selectedMonth) },
          { label: 'Cobrado', value: formatCopExact(totals.collected), sub: `${totals.paidCount} cobro${totals.paidCount === 1 ? '' : 's'} pagado${totals.paidCount === 1 ? '' : 's'}` },
          { label: 'Por cobrar', value: formatCopExact(totals.pending), sub: `${totals.pendingCount} cobro${totals.pendingCount === 1 ? '' : 's'} pendiente${totals.pendingCount === 1 ? '' : 's'}` },
          { label: 'Fee sin definir', value: String(totals.feeUndefined), sub: `de ${visibleClients.length} mostrados` },
          { label: 'Inversión en pauta bajo gestión', value: formatCopExact(totals.adSpendUnderManagement), sub: `presupuesto mensual, ${visibleClients.length} cliente${visibleClients.length === 1 ? '' : 's'}` },
          { label: 'Esperado — Samuel', value: formatCopExact(totals.byReceiver.samuel.expected), sub: `cobrado: ${formatCopExact(totals.byReceiver.samuel.collected)}` },
          { label: 'Esperado — Juanca', value: formatCopExact(totals.byReceiver.juanca.expected), sub: `cobrado: ${formatCopExact(totals.byReceiver.juanca.collected)}` },
          { label: 'Esperado — Compartido', value: formatCopExact(totals.byReceiver.compartido.expected), sub: `cobrado: ${formatCopExact(totals.byReceiver.compartido.collected)} (ya incluido 50/50 arriba)` },
          { label: 'Sin receptor asignado', value: String(totals.receiverUnassigned), sub: `de ${visibleClients.length} mostrados` },
          { label: 'Pendiente por pasar al socio', value: formatCopExact(totals.partnerPending), sub: 'cobros ya pagados, sin repartir' },
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
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente', 'Fee mensual (COP)', 'Presupuesto pauta (COP)', 'Recibe', 'Modalidad', `Estado de pago — ${getMonthLabel(selectedMonth)}`, ''].map((h) => (
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
                {visibleClients.map((client) => {
                  const row = rows.get(client.id);
                  if (!row) return null;
                  const rowError = errorByClient.get(client.id);
                  const billing = billingByClient.get(client.id);
                  const isUpdatingField = updatingFieldId === client.id;
                  const periods = periodsForFrequency(billing?.payment_frequency);
                  const isQuincenal = periods.length === 2;
                  const isExpanded = expandedClientIds.has(client.id);
                  const paidPeriods = periods.filter((p) => paymentFor(client.id, p)?.status === 'pagado').length;

                  return (
                    <Fragment key={client.id}>
                      <tr style={{ borderBottom: isQuincenal && isExpanded ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                          {client.name}
                          {client.status !== 'active' && (
                            <span className="meta-chip" style={{ marginLeft: 6, fontSize: '0.56rem' }}>{client.status}</span>
                          )}
                          {rowError && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.64rem', color: 'var(--danger)', whiteSpace: 'normal', maxWidth: 220 }}>
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
                            value={billing?.payment_receiver ?? ''}
                            disabled={isUpdatingField}
                            onChange={(e) =>
                              void handleUpdateBillingField(client.id, {
                                payment_receiver: (e.target.value || null) as BillingPaymentReceiver | null,
                              })
                            }
                            style={{
                              height: '34px',
                              padding: '0 8px',
                              background: 'var(--color-bg-input)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '4px',
                              color: billing?.payment_receiver ? 'var(--color-text-secondary)' : 'var(--fg-muted)',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '0.7rem',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {(Object.keys(RECEIVER_LABELS) as BillingPaymentReceiver[]).map((value) => (
                              <option key={value} value={value}>
                                {RECEIVER_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <select
                            value={billing?.payment_frequency ?? ''}
                            disabled={isUpdatingField}
                            onChange={(e) =>
                              void handleUpdateBillingField(client.id, {
                                payment_frequency: (e.target.value || null) as BillingPaymentFrequency | null,
                              })
                            }
                            style={{
                              height: '34px',
                              padding: '0 8px',
                              background: 'var(--color-bg-input)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '4px',
                              color: billing?.payment_frequency ? 'var(--color-text-secondary)' : 'var(--fg-muted)',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '0.7rem',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">—</option>
                            {(Object.keys(FREQUENCY_LABELS) as BillingPaymentFrequency[]).map((value) => (
                              <option key={value} value={value}>
                                {FREQUENCY_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          {isQuincenal ? (
                            <button
                              className="btn-secondary"
                              onClick={() => toggleExpanded(client.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem' }}
                            >
                              {paidPeriods} de {periods.length} pagadas
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          ) : (
                            renderPeriodControl(client, periods[0], billing, true)
                          )}
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
                      {isQuincenal && isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={7} style={{ padding: '4px 12px 14px 12px', background: 'var(--surface-2)' }}>
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                              {periods.map((period) => renderPeriodControl(client, period, billing, false))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {visibleClients.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>
                      No hay clientes para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
