import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import {
  listBillingInvoices,
  listBillingIssuers,
  listClientBilling,
  listClientBillingPayments,
  upsertClientBilling,
  upsertClientBillingPayment,
  upsertClientBillingPaymentsBatch,
} from '../services/billing';
import { updateClientAdBudget } from '../services/clients';
import type {
  BillingInvoice,
  BillingInvoiceIssuerKey,
  BillingIssuer,
  BillingPaymentFrequency,
  BillingPaymentMonthStatus,
  BillingPaymentPeriod,
  BillingPaymentReceiver,
  Client,
  ClientBilling,
  ClientBillingInput,
  ClientBillingPayment,
  ClientBillingPaymentInput,
} from '../lib/supabase';
import { formatCopExact } from '../lib/utils';
import { getMonthLabel } from '../utils/monthLabel';
import {
  PAY_DAYS_PRESET_LABELS,
  PAY_DAYS_PRESET_VALUES,
  type PayDaysPreset,
  periodLabel,
  periodRangeShort,
  periodsForFrequency,
  presetForPayDays,
} from '../lib/billingPeriods';
import { InvoiceGenerateModal } from '../components/billing/InvoiceGenerateModal';
import { BulkInvoiceModal } from '../components/billing/BulkInvoiceModal';

type StatusFilter = 'active' | 'all';
type ReceiverFilter = 'all' | BillingPaymentReceiver;
type RowSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = {
  samuel: 'Samuel',
  juanca: 'Juanca',
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

function paymentKey(clientId: string, period: BillingPaymentPeriod): string {
  return `${clientId}:${period}`;
}

function invoiceKey(clientId: string, month: string, period: BillingPaymentPeriod): string {
  return `${clientId}:${month}:${period}`;
}

// Igual que invoiceKey pero a partir de un ClientBillingPayment ya
// guardado — usado para fusionar el resultado de una liquidación en lote
// (que toca cobros de cualquier mes, no solo selectedMonth) de vuelta en
// el estado `payments`.
function paymentIdentityKey(p: ClientBillingPayment): string {
  return invoiceKey(p.client_id, p.month.slice(0, 10), p.period);
}

function periodAmountFor(fee: number | null | undefined, periodsCount: number): number | null {
  if (fee == null) return null;
  return periodsCount === 2 ? fee / 2 : fee;
}

// Fila editable local — campos de texto con autoguardado (debounce/blur).
// custom_pay_day solo se usa cuando el preset de "Día(s) de pago" es 'custom'.
type EditableRow = {
  client_id: string;
  monthly_fee: string;
  monthly_ad_budget: string;
  custom_pay_day: string;
};

function toEditableRow(clientId: string, budget: number | null | undefined, billing?: ClientBilling): EditableRow {
  const preset = presetForPayDays(billing?.pay_days);
  const singleCustomDay = preset === 'custom' && billing?.pay_days?.length === 1 ? billing.pay_days[0] : null;
  return {
    client_id: clientId,
    monthly_fee: billing?.monthly_fee != null ? String(billing.monthly_fee) : '',
    monthly_ad_budget: budget != null ? String(budget) : '',
    custom_pay_day: singleCustomDay != null ? String(singleCustomDay) : '',
  };
}

export function FacturacionPage() {
  const navigate = useNavigate();
  const { clients, loading: loadingClients, reload: reloadClients } = useClients();
  const [billingByClient, setBillingByClient] = useState<Map<string, ClientBilling>>(new Map());
  const [payments, setPayments] = useState<ClientBillingPayment[]>([]);
  const [issuers, setIssuers] = useState<BillingIssuer[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [rows, setRows] = useState<Map<string, EditableRow>>(new Map());
  const [togglingPaymentKey, setTogglingPaymentKey] = useState<string | null>(null);
  const [togglingPartnerKey, setTogglingPartnerKey] = useState<string | null>(null);
  const [errorByClient, setErrorByClient] = useState<Map<string, string>>(new Map());
  const [rowStatus, setRowStatusState] = useState<Map<string, RowSaveStatus>>(new Map());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [receiverFilter, setReceiverFilter] = useState<ReceiverFilter>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getBogotaCurrentMonth());
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
  const [customDayModeIds, setCustomDayModeIds] = useState<Set<string>>(new Set());
  const [invoiceModalFor, setInvoiceModalFor] = useState<{
    client: Client;
    period: BillingPaymentPeriod;
    amount: number;
    issuerKey: BillingInvoiceIssuerKey;
    issuer: BillingIssuer | undefined;
    payDays: number[] | null | undefined;
  } | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState<string>('all');
  const [invoiceIssuerFilter, setInvoiceIssuerFilter] = useState<'all' | BillingInvoiceIssuerKey>('all');

  // Espejo en ref de billingByClient: saveBillingPatch necesita el valor más
  // reciente al momento de ejecutarse (no el capturado en el closure de
  // cuando se llamó), porque puede quedar encolado detrás de otro guardado.
  const billingByClientRef = useRef<Map<string, ClientBilling>>(new Map());
  useEffect(() => {
    billingByClientRef.current = billingByClient;
  }, [billingByClient]);

  // Campos editados por el usuario y aún no guardados — por campo, no por
  // fila completa: así guardar el presupuesto no pisa un fee a medio
  // escribir en la misma fila, y viceversa.
  const dirtyFeeIdsRef = useRef<Set<string>>(new Set());
  const dirtyBudgetIdsRef = useRef<Set<string>>(new Set());
  const dirtyCustomDayIdsRef = useRef<Set<string>>(new Set());

  // Debounce (800ms) por campo+cliente.
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // "Guardado ✓" se apaga solo a los 2s.
  const statusHideTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Cola/bandera por client_id para evitar guardados concurrentes — un canal
  // para client_billing (fee/receptor/modalidad/días/emisor) y otro para el
  // presupuesto de pauta (vive en clients), independientes entre sí.
  const pendingBillingPatchRef = useRef<Map<string, Partial<ClientBillingInput>>>(new Map());
  const billingInFlightRef = useRef<Set<string>>(new Set());
  const pendingBudgetRef = useRef<Map<string, number | null>>(new Map());
  const budgetInFlightRef = useRef<Set<string>>(new Set());
  // Última acción fallida por cliente, para el botón "Reintentar".
  const retryRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const debounceTimers = debounceTimersRef.current;
    const statusHideTimers = statusHideTimersRef.current;
    return () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      for (const t of statusHideTimers.values()) clearTimeout(t);
    };
  }, []);

  function setRowStatus(clientId: string, status: RowSaveStatus) {
    setRowStatusState((current) => new Map(current).set(clientId, status));
    const existingTimer = statusHideTimersRef.current.get(clientId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      statusHideTimersRef.current.delete(clientId);
    }
    if (status === 'saved') {
      const timer = setTimeout(() => {
        setRowStatusState((current) => {
          if (current.get(clientId) !== 'saved') return current;
          const next = new Map(current);
          next.set(clientId, 'idle');
          return next;
        });
        statusHideTimersRef.current.delete(clientId);
      }, 2000);
      statusHideTimersRef.current.set(clientId, timer);
    }
  }

  function setRowError(clientId: string, message: string | null) {
    setErrorByClient((current) => {
      const next = new Map(current);
      if (message) next.set(clientId, message);
      else next.delete(clientId);
      return next;
    });
  }

  function scheduleDebouncedSave(key: string, run: () => void) {
    const existing = debounceTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      debounceTimersRef.current.delete(key);
      run();
    }, 800);
    debounceTimersRef.current.set(key, timer);
  }

  function cancelDebouncedSave(key: string) {
    const existing = debounceTimersRef.current.get(key);
    if (existing) {
      clearTimeout(existing);
      debounceTimersRef.current.delete(key);
    }
  }

  async function loadBilling() {
    setLoadingBilling(true);
    const [billing, pays, issuersList, invoicesList] = await Promise.all([
      listClientBilling(),
      listClientBillingPayments(),
      listBillingIssuers(),
      listBillingInvoices(),
    ]);
    const billingMap = new Map(billing.map((b) => [b.client_id, b]));
    setBillingByClient(billingMap);
    billingByClientRef.current = billingMap;
    setPayments(pays);
    setIssuers(issuersList);
    setInvoices(invoicesList);
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

  // Inicializa/resincroniza las filas editables. Cada campo se recalcula
  // salvo que esté "sucio" (editado sin guardar todavía) — por campo, no
  // por fila completa (ver refs de dirty arriba).
  useEffect(() => {
    setRows((current) => {
      const next = new Map(current);
      for (const client of visibleClients) {
        const prevRow = next.get(client.id);
        const fresh = toEditableRow(client.id, client.monthly_ad_budget, billingByClient.get(client.id));
        if (!prevRow) {
          next.set(client.id, fresh);
          continue;
        }
        next.set(client.id, {
          client_id: client.id,
          monthly_fee: dirtyFeeIdsRef.current.has(client.id) ? prevRow.monthly_fee : fresh.monthly_fee,
          monthly_ad_budget: dirtyBudgetIdsRef.current.has(client.id) ? prevRow.monthly_ad_budget : fresh.monthly_ad_budget,
          custom_pay_day: dirtyCustomDayIdsRef.current.has(client.id) ? prevRow.custom_pay_day : fresh.custom_pay_day,
        });
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

  const invoicesByKey = useMemo(() => {
    const map = new Map<string, BillingInvoice>();
    for (const inv of invoices) {
      map.set(invoiceKey(inv.client_id, inv.month.slice(0, 10), inv.period), inv);
    }
    return map;
  }, [invoices]);

  const issuersByKey = useMemo(() => new Map(issuers.map((i) => [i.key, i])), [issuers]);

  const invoiceMonthOptions = useMemo(() => {
    const months = new Set(invoices.map((inv) => inv.month.slice(0, 10)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        if (invoiceMonthFilter !== 'all' && inv.month.slice(0, 10) !== invoiceMonthFilter) return false;
        if (invoiceIssuerFilter !== 'all' && inv.issuer_key !== invoiceIssuerFilter) return false;
        return true;
      }),
    [invoices, invoiceMonthFilter, invoiceIssuerFilter],
  );

  // Totales del mes. "El socio" ya no es una convención fija: ahora se
  // calcula con invoice_issuer (quién emite/cobra) contra payment_receiver
  // (a quién pertenece el fee). Si compartido, la mitad es del NO-emisor;
  // si el receptor es samuel/juanca y emite el otro, el 100% es del
  // receptor; si receptor == emisor, no hay nada que pasar.
  const totals = useMemo(() => {
    let feeExpected = 0;
    let collected = 0;
    let pending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let feeUndefined = 0;
    let adSpendUnderManagement = 0;
    let receiverUnassigned = 0;
    let owedBySamuelToJuanca = 0;
    let owedByJuancaToSamuel = 0;
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
      const issuer = billing?.invoice_issuer ?? null;
      if (!receiver) receiverUnassigned += 1;

      const periods = periodsForFrequency(billing?.payment_frequency);
      const periodAmount = periodAmountFor(fee, periods.length) ?? 0;

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

        if (isPaid && !payment?.partner_paid && issuer && receiver) {
          if (receiver === 'compartido') {
            const share = periodAmount / 2;
            if (issuer === 'samuel') owedBySamuelToJuanca += share;
            else owedByJuancaToSamuel += share;
          } else if (receiver !== issuer) {
            if (issuer === 'samuel') owedBySamuelToJuanca += periodAmount;
            else owedByJuancaToSamuel += periodAmount;
          }
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
      owedBySamuelToJuanca,
      owedByJuancaToSamuel,
      partnerPending: owedBySamuelToJuanca + owedByJuancaToSamuel,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleClients, billingByClient, paymentByClientPeriod]);

  // Saldo neto acumulado entre socios: a diferencia de `totals` (que mira
  // solo selectedMonth y visibleClients), este recorre TODOS los cobros
  // compartidos pagados de TODOS los meses con partner_paid=false, sin
  // filtro de mes/estado/receptor — lo no liquidado se arrastra. Usa la
  // configuración ACTUAL del cliente (receptor/modalidad/emisor/fee): no
  // hay snapshot histórico de esos campos por cobro, así que si cambiaron
  // después de un cobro viejo sin liquidar, se recalcula con el valor de
  // hoy (misma limitación que el resto de esta página).
  const netBalance = useMemo(() => {
    let owedBySamuelToJuanca = 0;
    let owedByJuancaToSamuel = 0;
    const settlementCandidates: {
      client_id: string;
      month: string;
      period: BillingPaymentPeriod;
      paid_at: string | null;
      half: number;
      direction: 'samuel_to_juanca' | 'juanca_to_samuel';
    }[] = [];

    for (const payment of payments) {
      if (payment.status !== 'pagado' || payment.partner_paid) continue;
      const billing = billingByClient.get(payment.client_id);
      if (!billing || billing.payment_receiver !== 'compartido' || !billing.invoice_issuer) continue;
      if (billing.monthly_fee == null) continue;

      const periods = periodsForFrequency(billing.payment_frequency);
      if (!periods.includes(payment.period)) continue;

      const half = (periodAmountFor(billing.monthly_fee, periods.length) ?? 0) / 2;
      const direction = billing.invoice_issuer === 'samuel' ? 'samuel_to_juanca' : 'juanca_to_samuel';
      if (direction === 'samuel_to_juanca') owedBySamuelToJuanca += half;
      else owedByJuancaToSamuel += half;

      settlementCandidates.push({
        client_id: payment.client_id,
        month: payment.month.slice(0, 10),
        period: payment.period,
        paid_at: payment.paid_at,
        half,
        direction,
      });
    }

    return {
      owedBySamuelToJuanca,
      owedByJuancaToSamuel,
      net: owedBySamuelToJuanca - owedByJuancaToSamuel,
      settlementCandidates,
    };
  }, [payments, billingByClient]);

  // Historial de liquidaciones derivado de partner_paid_at — sin tabla
  // nueva: agrupa los cobros compartidos ya repartidos por fecha y muestra
  // el neto de cada fecha (puede mezclar ambas direcciones si ese día se
  // liquidaron cobros de los dos emisores).
  const settlementHistory = useMemo(() => {
    const byDate = new Map<string, { samuelToJuanca: number; juancaToSamuel: number }>();

    for (const payment of payments) {
      if (!payment.partner_paid || !payment.partner_paid_at) continue;
      const billing = billingByClient.get(payment.client_id);
      if (!billing || billing.payment_receiver !== 'compartido' || !billing.invoice_issuer) continue;
      if (billing.monthly_fee == null) continue;

      const periods = periodsForFrequency(billing.payment_frequency);
      if (!periods.includes(payment.period)) continue;

      const half = (periodAmountFor(billing.monthly_fee, periods.length) ?? 0) / 2;
      const entry = byDate.get(payment.partner_paid_at) ?? { samuelToJuanca: 0, juancaToSamuel: 0 };
      if (billing.invoice_issuer === 'samuel') entry.samuelToJuanca += half;
      else entry.juancaToSamuel += half;
      byDate.set(payment.partner_paid_at, entry);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, { samuelToJuanca, juancaToSamuel }]) => ({ date, net: samuelToJuanca - juancaToSamuel }));
  }, [payments, billingByClient]);

  async function handleSettleBalance() {
    const candidates = netBalance.settlementCandidates;
    if (candidates.length === 0) return;

    const who =
      netBalance.net > 0
        ? `Samuel le debe a Juanca ${formatCopExact(netBalance.net)}`
        : netBalance.net < 0
          ? `Juanca le debe a Samuel ${formatCopExact(Math.abs(netBalance.net))}`
          : 'Están a mano ($0)';
    const confirmed = window.confirm(
      `${who}.\n\nEsto marcará ${candidates.length} cobro${candidates.length === 1 ? '' : 's'} compartido${candidates.length === 1 ? '' : 's'} como repartido${candidates.length === 1 ? '' : 's'} (partner_paid = true, hoy). ¿Confirmas la liquidación?`,
    );
    if (!confirmed) return;

    setSettling(true);
    setSettleError(null);

    const today = todayIsoDate();
    const payloads: ClientBillingPaymentInput[] = candidates.map((c) => ({
      client_id: c.client_id,
      month: c.month,
      period: c.period,
      status: 'pagado',
      paid_at: c.paid_at,
      partner_paid: true,
      partner_paid_at: today,
    }));

    const result = await upsertClientBillingPaymentsBatch(payloads);
    if (result.error) {
      setSettleError(result.error);
    } else if (result.data) {
      const saved = result.data;
      setPayments((current) => {
        const byKey = new Map(current.map((p) => [paymentIdentityKey(p), p] as const));
        for (const s of saved) byKey.set(paymentIdentityKey(s), s);
        return Array.from(byKey.values());
      });
    }
    setSettling(false);
  }

  function updateRow(clientId: string, patch: Partial<EditableRow>) {
    if ('monthly_fee' in patch) dirtyFeeIdsRef.current.add(clientId);
    if ('monthly_ad_budget' in patch) dirtyBudgetIdsRef.current.add(clientId);
    if ('custom_pay_day' in patch) dirtyCustomDayIdsRef.current.add(clientId);
    setRows((current) => {
      const next = new Map(current);
      const existing = next.get(clientId);
      if (existing) next.set(clientId, { ...existing, ...patch });
      return next;
    });
  }

  // Guarda un parche sobre client_billing, encolando si ya hay un guardado
  // en vuelo para ese cliente (se fusiona con lo pendiente, nunca se pierde
  // un cambio). SIEMPRE envía el registro completo (mezclando sobre el
  // último valor conocido) porque Postgrest upsert solo toca las columnas
  // presentes en el payload.
  async function saveBillingPatch(clientId: string, patch: Partial<ClientBillingInput>) {
    const merged = { ...(pendingBillingPatchRef.current.get(clientId) ?? {}), ...patch };
    pendingBillingPatchRef.current.set(clientId, merged);
    if (billingInFlightRef.current.has(clientId)) return;

    billingInFlightRef.current.add(clientId);
    setRowStatus(clientId, 'saving');
    setRowError(clientId, null);

    let hadError = false;

    while (pendingBillingPatchRef.current.has(clientId)) {
      const toSend = pendingBillingPatchRef.current.get(clientId)!;
      pendingBillingPatchRef.current.delete(clientId);

      const existing = billingByClientRef.current.get(clientId);
      const payload: ClientBillingInput = {
        client_id: clientId,
        monthly_fee: existing?.monthly_fee ?? null,
        currency: existing?.currency ?? 'COP',
        payment_receiver: existing?.payment_receiver ?? null,
        payment_frequency: existing?.payment_frequency ?? null,
        pay_days: existing?.pay_days ?? null,
        invoice_issuer: existing?.invoice_issuer ?? null,
        ...toSend,
      };

      const result = await upsertClientBilling(payload);
      if (result.error) {
        hadError = true;
        setRowError(clientId, result.error);
        // deja lo que faltó en la cola para que "Reintentar" lo retome
        pendingBillingPatchRef.current.set(clientId, { ...toSend, ...(pendingBillingPatchRef.current.get(clientId) ?? {}) });
        break;
      }

      if (result.data) {
        const saved = result.data as ClientBilling;
        billingByClientRef.current.set(clientId, saved);
        setBillingByClient((current) => new Map(current).set(clientId, saved));
      }
      if ('monthly_fee' in toSend) dirtyFeeIdsRef.current.delete(clientId);
      if ('pay_days' in toSend) dirtyCustomDayIdsRef.current.delete(clientId);
    }

    billingInFlightRef.current.delete(clientId);
    setRowStatus(clientId, hadError ? 'error' : 'saved');
    if (hadError) retryRef.current.set(clientId, () => void saveBillingPatch(clientId, {}));
    else retryRef.current.delete(clientId);
  }

  async function saveAdBudget(clientId: string, value: number | null) {
    pendingBudgetRef.current.set(clientId, value);
    if (budgetInFlightRef.current.has(clientId)) return;

    budgetInFlightRef.current.add(clientId);
    setRowStatus(clientId, 'saving');
    setRowError(clientId, null);

    let hadError = false;
    let lastSent: number | null = value;

    while (pendingBudgetRef.current.has(clientId)) {
      const toSend = pendingBudgetRef.current.get(clientId) ?? null;
      pendingBudgetRef.current.delete(clientId);
      lastSent = toSend;

      const result = await updateClientAdBudget(clientId, toSend);
      if (result.error) {
        hadError = true;
        setRowError(clientId, result.error);
        pendingBudgetRef.current.set(clientId, toSend);
        break;
      }
    }

    if (!hadError) {
      dirtyBudgetIdsRef.current.delete(clientId);
      await reloadClients();
    }

    budgetInFlightRef.current.delete(clientId);
    setRowStatus(clientId, hadError ? 'error' : 'saved');
    if (hadError) retryRef.current.set(clientId, () => void saveAdBudget(clientId, lastSent));
    else retryRef.current.delete(clientId);
  }

  function handleFeeChange(clientId: string, value: string) {
    updateRow(clientId, { monthly_fee: value });
    scheduleDebouncedSave(`${clientId}:fee`, () => commitFee(clientId, value));
  }

  function handleFeeBlur(clientId: string, value: string) {
    cancelDebouncedSave(`${clientId}:fee`);
    commitFee(clientId, value);
  }

  function commitFee(clientId: string, rawValue: string) {
    const nextStr = rawValue.trim();
    if (nextStr && Number.isNaN(Number(nextStr))) return;
    const committed = billingByClientRef.current.get(clientId)?.monthly_fee;
    const committedStr = committed != null ? String(committed) : '';
    if (nextStr === committedStr) return;
    void saveBillingPatch(clientId, { monthly_fee: nextStr ? Number(nextStr) : null });
  }

  function handleBudgetChange(client: Client, value: string) {
    updateRow(client.id, { monthly_ad_budget: value });
    scheduleDebouncedSave(`${client.id}:budget`, () => commitBudget(client, value));
  }

  function handleBudgetBlur(client: Client, value: string) {
    cancelDebouncedSave(`${client.id}:budget`);
    commitBudget(client, value);
  }

  function commitBudget(client: Client, rawValue: string) {
    const nextStr = rawValue.trim();
    if (nextStr && Number.isNaN(Number(nextStr))) return;
    const committedStr = client.monthly_ad_budget != null ? String(client.monthly_ad_budget) : '';
    if (nextStr === committedStr) return;
    void saveAdBudget(client.id, nextStr ? Number(nextStr) : null);
  }

  function handleCustomDayChange(clientId: string, value: string) {
    updateRow(clientId, { custom_pay_day: value });
    scheduleDebouncedSave(`${clientId}:customDay`, () => commitCustomDay(clientId, value));
  }

  function handleCustomDayBlur(clientId: string, value: string) {
    cancelDebouncedSave(`${clientId}:customDay`);
    commitCustomDay(clientId, value);
  }

  function commitCustomDay(clientId: string, rawValue: string) {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const day = Number(trimmed);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    const committed = billingByClientRef.current.get(clientId)?.pay_days;
    if (committed && committed.length === 1 && committed[0] === day) return;
    void saveBillingPatch(clientId, { pay_days: [day] });
  }

  function handlePayDaysPresetChange(clientId: string, preset: PayDaysPreset) {
    if (preset === 'custom') {
      setCustomDayModeIds((current) => new Set(current).add(clientId));
      return;
    }
    setCustomDayModeIds((current) => {
      if (!current.has(clientId)) return current;
      const next = new Set(current);
      next.delete(clientId);
      return next;
    });
    void saveBillingPatch(clientId, { pay_days: PAY_DAYS_PRESET_VALUES[preset] });
  }

  function toggleExpanded(clientId: string) {
    setExpandedClientIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
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

  function handleInvoiceCreated(invoice: BillingInvoice) {
    setInvoices((current) => [invoice, ...current]);
    setInvoiceModalFor(null);
    navigate(`/admin/cuentas-de-cobro/${invoice.id}`);
  }

  function handleInvoicesIssuedInBulk(newInvoices: BillingInvoice[]) {
    setInvoices((current) => [...newInvoices, ...current]);
  }

  function renderPeriodControl(client: Client, period: BillingPaymentPeriod, billing: ClientBilling | undefined, compact: boolean) {
    const payment = paymentFor(client.id, period);
    const isPaid = payment?.status === 'pagado';
    const key = paymentKey(client.id, period);
    const isToggling = togglingPaymentKey === key;
    const isTogglingPartner = togglingPartnerKey === key;
    const amount = periodAmountFor(billing?.monthly_fee, periodsForFrequency(billing?.payment_frequency).length);
    const issuerKey = billing?.invoice_issuer ?? null;
    const issuer = issuerKey ? issuersByKey.get(issuerKey) : undefined;
    const issuerReady = !!issuer?.legal_name && !!issuer?.account_number;
    const existingInvoice = invoicesByKey.get(invoiceKey(client.id, selectedMonth, period));
    const invoiceDisabled = amount == null || !issuerKey || !issuerReady;
    const invoiceTitle = !issuerKey
      ? 'Asigna un emisor primero'
      : !issuerReady
        ? 'Completa los datos del emisor'
        : amount == null
          ? 'Falta el fee'
          : undefined;

    return (
      <div key={period} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
        {!compact && (
          <span className="meta-chip" style={{ fontSize: '0.56rem', width: 'fit-content' }}>
            {periodLabel(period, billing?.pay_days)}
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
        {/* Solo hay "parte del socio" que repartir cuando el fee es compartido
            50/50 — si el receptor es samuel o juanca, el 100% ya es suyo y no
            hay nada que pasar. */}
        {isPaid && billing?.payment_receiver === 'compartido' && (() => {
          const partnerName = issuerKey === 'juanca' ? 'Samuel' : issuerKey === 'samuel' ? 'Juanca' : null;
          const halfAmount = amount != null ? amount / 2 : null;
          const canToggle = !!partnerName;

          return (
            <button
              className="btn-ghost"
              disabled={!canToggle || isTogglingPartner}
              onClick={() => void handleTogglePartnerPaid(client.id, period)}
              title={canToggle ? 'Click para marcar/desmarcar' : 'Asigna quién cobra (Emite / cobra) primero'}
              style={{
                fontSize: '0.58rem',
                padding: '3px 8px',
                opacity: canToggle ? 1 : 0.5,
                cursor: canToggle ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              <span>
                {!canToggle
                  ? 'Falta definir quién cobra'
                  : isTogglingPartner
                    ? 'Guardando...'
                    : payment?.partner_paid
                      ? `Incluido en la liquidación ✓${payment.partner_paid_at ? ` (${payment.partner_paid_at})` : ''}`
                      : `Ya le pasé a ${partnerName} su 50%`}
              </span>
              {halfAmount != null && (
                <span style={{ fontSize: '0.54rem', color: 'var(--fg-muted)' }}>{formatCopExact(halfAmount)}</span>
              )}
            </button>
          );
        })()}

        {existingInvoice ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Link
              to={`/admin/cuentas-de-cobro/${existingInvoice.id}`}
              className="btn-secondary"
              style={{ fontSize: '0.56rem', textDecoration: 'none', padding: '3px 8px' }}
            >
              Ver/reimprimir #{String(existingInvoice.invoice_number).padStart(5, '0')}
            </Link>
            <button
              className="btn-ghost"
              disabled={invoiceDisabled}
              title={invoiceTitle}
              style={{ fontSize: '0.56rem', padding: '3px 8px' }}
              onClick={() => issuerKey && amount != null && setInvoiceModalFor({ client, period, amount, issuerKey, issuer, payDays: billing?.pay_days })}
            >
              Emitir otra
            </button>
          </div>
        ) : (
          <button
            className="btn-secondary"
            disabled={invoiceDisabled}
            title={invoiceTitle}
            style={{ fontSize: '0.56rem', padding: '3px 8px' }}
            onClick={() => issuerKey && amount != null && setInvoiceModalFor({ client, period, amount, issuerKey, issuer, payDays: billing?.pay_days })}
          >
            Cuenta de cobro
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
          <p className="page-subtitle">Honorarios, presupuesto de pauta y cuentas de cobro · solo visible para admins</p>
        </div>
        <Link to="/admin/emisores" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Datos de emisores
        </Link>
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

        <button className="btn-secondary" onClick={() => setBulkModalOpen(true)}>
          Generar cuentas de cobro del mes
        </button>

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
          { label: 'Pendiente por pasar al socio', value: formatCopExact(totals.partnerPending), sub: 'cobros pagados, sin repartir' },
          { label: 'Samuel le debe a Juanca', value: formatCopExact(totals.owedBySamuelToJuanca), sub: 'según quién emite/cobra' },
          { label: 'Juanca le debe a Samuel', value: formatCopExact(totals.owedByJuancaToSamuel), sub: 'según quién emite/cobra' },
        ].map((card) => (
          <div key={card.label} className="card-glass portal-kpi-card">
            <p className="portal-kpi-label">{card.label}</p>
            <p className="portal-kpi-value">{card.value}</p>
            <p className="portal-kpi-sub">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="card-glass card-padded" style={{ margin: '0 24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="number-label" style={{ fontSize: '0.64rem', color: 'var(--fg-muted)' }}>Saldo neto entre socios (acumulado, todos los meses)</p>
            <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg)' }}>
              {netBalance.net > 0
                ? `Samuel le debe a Juanca ${formatCopExact(netBalance.net)}`
                : netBalance.net < 0
                  ? `Juanca le debe a Samuel ${formatCopExact(Math.abs(netBalance.net))}`
                  : 'Están a mano'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
              Samuel debe {formatCopExact(netBalance.owedBySamuelToJuanca)} · Juanca debe {formatCopExact(netBalance.owedByJuancaToSamuel)}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '0.64rem', color: 'var(--fg-muted)' }}>
              Referencia de {getMonthLabel(selectedMonth)}: Samuel debe {formatCopExact(totals.owedBySamuelToJuanca)} · Juanca debe {formatCopExact(totals.owedByJuancaToSamuel)}
            </p>
          </div>
          <button
            className="btn-primary"
            disabled={netBalance.settlementCandidates.length === 0 || settling}
            onClick={() => void handleSettleBalance()}
          >
            {settling ? 'Liquidando...' : 'Liquidar saldo'}
          </button>
        </div>

        {settleError && (
          <p style={{ marginTop: 12, fontSize: '0.74rem', color: 'var(--danger)' }}>{settleError}</p>
        )}

        {settlementHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Historial de liquidaciones
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {settlementHistory.map(({ date, net }) => (
                <li key={date} style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>
                  {date} —{' '}
                  {net > 0
                    ? `Samuel le pagó a Juanca ${formatCopExact(net)}`
                    : net < 0
                      ? `Juanca le pagó a Samuel ${formatCopExact(Math.abs(net))}`
                      : 'quedaron a mano'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card-glass" style={{ margin: '0 24px 24px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
            Cargando facturación...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente', 'Fee mensual (COP)', 'Presupuesto pauta (COP)', 'Recibe', 'Modalidad', 'Día(s) de pago', 'Emite / cobra', `Estado de pago — ${getMonthLabel(selectedMonth)}`].map((h) => (
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
                  const status = rowStatus.get(client.id) ?? 'idle';
                  const billing = billingByClient.get(client.id);
                  const periods = periodsForFrequency(billing?.payment_frequency);
                  const isQuincenal = periods.length === 2;
                  const isExpanded = expandedClientIds.has(client.id);
                  const paidPeriods = periods.filter((p) => paymentFor(client.id, p)?.status === 'pagado').length;
                  const effectivePreset: PayDaysPreset = customDayModeIds.has(client.id)
                    ? 'custom'
                    : presetForPayDays(billing?.pay_days);
                  const issuerKey = billing?.invoice_issuer ?? null;
                  const issuer = issuerKey ? issuersByKey.get(issuerKey) : undefined;
                  const issuerIncomplete = !!issuerKey && (!issuer?.legal_name || !issuer?.account_number);

                  return (
                    <Fragment key={client.id}>
                      <tr style={{ borderBottom: isQuincenal && isExpanded ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                          {client.name}
                          {client.status !== 'active' && (
                            <span className="meta-chip" style={{ marginLeft: 6, fontSize: '0.56rem' }}>{client.status}</span>
                          )}
                          <div style={{ marginTop: 4 }}>
                            {status === 'saving' && (
                              <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>Guardando…</span>
                            )}
                            {status === 'saved' && (
                              <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontFamily: 'JetBrains Mono' }}>Guardado ✓</span>
                            )}
                            {status === 'error' && rowError && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                <p style={{ margin: 0, fontSize: '0.64rem', color: 'var(--danger)', whiteSpace: 'normal', maxWidth: 220 }}>
                                  {rowError}
                                </p>
                                <button
                                  className="btn-ghost"
                                  style={{ fontSize: '0.58rem', padding: '2px 8px' }}
                                  onClick={() => retryRef.current.get(client.id)?.()}
                                >
                                  Reintentar
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <input
                            className="form-input"
                            type="number"
                            min={0}
                            value={row.monthly_fee}
                            onChange={(e) => handleFeeChange(client.id, e.target.value)}
                            onBlur={(e) => handleFeeBlur(client.id, e.target.value)}
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
                            onChange={(e) => handleBudgetChange(client, e.target.value)}
                            onBlur={(e) => handleBudgetBlur(client, e.target.value)}
                            placeholder="—"
                            style={{ width: 130 }}
                          />
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <select
                            value={billing?.payment_receiver ?? ''}
                            onChange={(e) =>
                              void saveBillingPatch(client.id, {
                                payment_receiver: (e.target.value || null) as BillingPaymentReceiver | null,
                              })
                            }
                            style={selectStyle(!!billing?.payment_receiver)}
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
                            onChange={(e) =>
                              void saveBillingPatch(client.id, {
                                payment_frequency: (e.target.value || null) as BillingPaymentFrequency | null,
                              })
                            }
                            style={selectStyle(!!billing?.payment_frequency)}
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
                          <select
                            value={effectivePreset}
                            onChange={(e) => handlePayDaysPresetChange(client.id, e.target.value as PayDaysPreset)}
                            style={selectStyle(true)}
                          >
                            {(Object.keys(PAY_DAYS_PRESET_LABELS) as PayDaysPreset[]).map((value) => (
                              <option key={value} value={value}>
                                {PAY_DAYS_PRESET_LABELS[value]}
                              </option>
                            ))}
                          </select>
                          {effectivePreset === 'custom' && (
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              max={31}
                              placeholder="Día (1-31)"
                              value={row.custom_pay_day}
                              onChange={(e) => handleCustomDayChange(client.id, e.target.value)}
                              onBlur={(e) => handleCustomDayBlur(client.id, e.target.value)}
                              style={{ width: 110, marginTop: 6 }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <select
                            value={issuerKey ?? ''}
                            onChange={(e) =>
                              void saveBillingPatch(client.id, {
                                invoice_issuer: (e.target.value || null) as BillingInvoiceIssuerKey | null,
                              })
                            }
                            style={selectStyle(!!issuerKey)}
                          >
                            <option value="">Sin asignar</option>
                            {(Object.keys(ISSUER_LABELS) as BillingInvoiceIssuerKey[]).map((value) => (
                              <option key={value} value={value}>
                                {ISSUER_LABELS[value]}
                              </option>
                            ))}
                          </select>
                          {issuerIncomplete && (
                            <Link
                              to="/admin/emisores"
                              className="meta-chip"
                              style={{ display: 'block', marginTop: 4, color: 'var(--warning)', textDecoration: 'none', width: 'fit-content' }}
                            >
                              Completa los datos del emisor
                            </Link>
                          )}
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
                      </tr>
                      {isQuincenal && isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={8} style={{ padding: '4px 12px 14px 12px', background: 'var(--surface-2)' }}>
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
                    <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>
                      No hay clientes para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-glass" style={{ margin: '0 24px 24px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h2 className="number-label" style={{ fontSize: '0.72rem', color: 'var(--fg)' }}>Cuentas de cobro emitidas</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={invoiceMonthFilter} onChange={(e) => setInvoiceMonthFilter(e.target.value)} style={selectStyle(invoiceMonthFilter !== 'all')}>
              <option value="all">Todos los meses</option>
              {invoiceMonthOptions.map((month) => (
                <option key={month} value={month}>{getMonthLabel(month)}</option>
              ))}
            </select>
            <select
              value={invoiceIssuerFilter}
              onChange={(e) => setInvoiceIssuerFilter(e.target.value as 'all' | BillingInvoiceIssuerKey)}
              style={selectStyle(invoiceIssuerFilter !== 'all')}
            >
              <option value="all">Todos los emisores</option>
              <option value="samuel">Samuel</option>
              <option value="juanca">Juanca</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Número', 'Emisor', 'Cliente', 'Mes', 'Periodo', 'Total', 'Fecha', ''].map((h) => (
                  <th key={h} className="number-label" style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap', fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => {
                const client = clients.find((c) => c.id === invoice.client_id);
                const month = invoice.month.slice(0, 10);
                return (
                  <tr key={invoice.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'JetBrains Mono', fontSize: '0.74rem' }}>#{String(invoice.invoice_number).padStart(5, '0')}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.74rem' }}>{ISSUER_LABELS[invoice.issuer_key]}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.74rem' }}>{client?.name ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.74rem' }}>{getMonthLabel(month)}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.74rem', fontFamily: 'JetBrains Mono' }}>{periodRangeShort(month, invoice.period)}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'JetBrains Mono', fontSize: '0.74rem' }}>{formatCopExact(invoice.total)}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{invoice.issue_date}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <Link to={`/admin/cuentas-de-cobro/${invoice.id}`} className="btn-secondary" style={{ fontSize: '0.64rem', textDecoration: 'none' }}>
                        Ver / reimprimir
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>
                    {invoices.length === 0 ? 'Todavía no se ha emitido ninguna cuenta de cobro.' : 'No hay cuentas de cobro para este filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoiceModalFor && (
        <InvoiceGenerateModal
          client={invoiceModalFor.client}
          period={invoiceModalFor.period}
          month={selectedMonth}
          defaultAmount={invoiceModalFor.amount}
          issuerKey={invoiceModalFor.issuerKey}
          issuer={invoiceModalFor.issuer}
          payDays={invoiceModalFor.payDays}
          onClose={() => setInvoiceModalFor(null)}
          onCreated={handleInvoiceCreated}
        />
      )}

      {bulkModalOpen && (
        <BulkInvoiceModal
          month={selectedMonth}
          clients={clients}
          billingByClient={billingByClient}
          issuersByKey={issuersByKey}
          invoicesByKey={invoicesByKey}
          onClose={() => setBulkModalOpen(false)}
          onIssued={handleInvoicesIssuedInBulk}
        />
      )}
    </div>
  );
}

function selectStyle(hasValue: boolean): CSSProperties {
  return {
    height: '34px',
    padding: '0 8px',
    background: 'var(--color-bg-input)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    color: hasValue ? 'var(--color-text-secondary)' : 'var(--fg-muted)',
    fontFamily: 'JetBrains Mono',
    fontSize: '0.7rem',
    outline: 'none',
    cursor: 'pointer',
  };
}
