import { useMemo, useState } from 'react';
import { createBillingInvoice } from '../../services/billing';
import type {
  BillingInvoice,
  BillingInvoiceIssuerKey,
  BillingIssuer,
  BillingPaymentPeriod,
  Client,
  ClientBilling,
} from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';
import { getMonthLabel } from '../../utils/monthLabel';
import {
  defaultIssueDateForPeriod,
  periodDateRangeText,
  periodLabel,
  periodsForFrequency,
} from '../../lib/billingPeriods';

const ISSUER_LABELS: Record<BillingInvoiceIssuerKey, string> = { samuel: 'Samuel', juanca: 'Juanca' };

type Candidate = {
  key: string;
  client: Client;
  period: BillingPaymentPeriod;
  amount: number | null;
  issuerKey: BillingInvoiceIssuerKey | null;
  payDays: number[] | null | undefined;
  disabledReason: string | null;
};

type CandidateResult = 'pending' | 'emitting' | 'done' | 'error';

interface Props {
  month: string;
  clients: Client[];
  billingByClient: Map<string, ClientBilling>;
  issuersByKey: Map<BillingInvoiceIssuerKey, BillingIssuer>;
  invoicesByKey: Map<string, BillingInvoice>;
  onClose: () => void;
  onIssued: (invoices: BillingInvoice[]) => void;
}

function periodAmountFor(fee: number | null | undefined, periodsCount: number): number | null {
  if (fee == null) return null;
  return periodsCount === 2 ? fee / 2 : fee;
}

export function BulkInvoiceModal({ month, clients, billingByClient, issuersByKey, invoicesByKey, onClose, onIssued }: Props) {
  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = [];
    for (const client of clients) {
      const billing = billingByClient.get(client.id);
      const periods = periodsForFrequency(billing?.payment_frequency);

      for (const period of periods) {
        if (invoicesByKey.has(`${client.id}:${month}:${period}`)) continue;

        const amount = periodAmountFor(billing?.monthly_fee, periods.length);
        const issuerKey = billing?.invoice_issuer ?? null;
        const issuer = issuerKey ? issuersByKey.get(issuerKey) : undefined;
        const issuerReady = !!issuer?.legal_name && !!issuer?.account_number;

        const disabledReason =
          amount == null
            ? 'Falta el fee'
            : !issuerKey
              ? 'Sin emisor asignado'
              : !issuerReady
                ? 'Datos del emisor incompletos'
                : null;

        list.push({
          key: `${client.id}:${period}`,
          client,
          period,
          amount,
          issuerKey,
          payDays: billing?.pay_days,
          disabledReason,
        });
      }
    }

    return list.sort((a, b) => {
      const issuerCompare = (a.issuerKey ?? 'zzz').localeCompare(b.issuerKey ?? 'zzz');
      if (issuerCompare !== 0) return issuerCompare;
      return a.client.name.localeCompare(b.client.name);
    });
  }, [clients, billingByClient, issuersByKey, invoicesByKey, month]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => !c.disabledReason).map((c) => c.key)),
  );
  const [results, setResults] = useState<Map<string, { status: CandidateResult; error?: string }>>(new Map());
  const [emitting, setEmitting] = useState(false);
  const [done, setDone] = useState(false);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleEmit() {
    const toEmit = candidates.filter((c) => !c.disabledReason && selected.has(c.key));
    if (toEmit.length === 0) return;

    setEmitting(true);
    const created: BillingInvoice[] = [];
    const nextResults = new Map(results);

    for (const candidate of toEmit) {
      nextResults.set(candidate.key, { status: 'emitting' });
      setResults(new Map(nextResults));

      const issueDate = defaultIssueDateForPeriod(month, candidate.period, candidate.payDays);
      const result = await createBillingInvoice({
        clientId: candidate.client.id,
        issuerKey: candidate.issuerKey!,
        month,
        period: candidate.period,
        items: [
          { qty: 1, description: 'Actividades como Trafficker / Estratega en Meta Ads e Instagram', value: null },
          { qty: 1, description: `Servicios de Growth Marketing ${periodDateRangeText(month, candidate.period)}`, value: candidate.amount },
        ],
        total: candidate.amount ?? 0,
        issueDate,
      });

      if (result.error) {
        nextResults.set(candidate.key, { status: 'error', error: result.error });
      } else {
        nextResults.set(candidate.key, { status: 'done' });
        if (result.data) created.push(result.data);
      }
      setResults(new Map(nextResults));
    }

    if (created.length > 0) onIssued(created);
    setEmitting(false);
    setDone(true);
  }

  const emittedCount = Array.from(results.values()).filter((r) => r.status === 'done').length;
  const errorCount = Array.from(results.values()).filter((r) => r.status === 'error').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Generar cuentas de cobro del mes</h2>
            <p className="modal-subtitle">{getMonthLabel(month)} · {candidates.length} cobro{candidates.length === 1 ? '' : 's'} sin cuenta emitida</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {candidates.length === 0 ? (
            <p className="empty-note">Ya hay una cuenta de cobro emitida para todos los cobros de este mes.</p>
          ) : done ? (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--fg)', marginBottom: 12 }}>
                {emittedCount} emitida{emittedCount === 1 ? '' : 's'}
                {errorCount > 0 ? ` · ${errorCount} con error` : ''}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidates
                  .filter((c) => results.has(c.key))
                  .map((c) => {
                    const r = results.get(c.key)!;
                    return (
                      <li key={c.key} style={{ fontSize: '0.72rem', color: r.status === 'error' ? 'var(--danger)' : 'var(--fg-muted)' }}>
                        {c.client.name} · {periodLabel(c.period, c.payDays)} —{' '}
                        {r.status === 'done' ? 'emitida ✓' : r.status === 'error' ? `error: ${r.error}` : r.status}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Cliente', 'Periodo', 'Fecha', 'Valor', 'Emisor'].map((h) => (
                    <th key={h} className="number-label" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 400, fontSize: '0.6rem', color: 'var(--fg-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="checkbox"
                        disabled={!!c.disabledReason}
                        checked={selected.has(c.key)}
                        onChange={() => toggle(c.key)}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: '0.78rem' }}>{c.client.name}</td>
                    <td style={{ padding: '6px 8px', fontSize: '0.74rem' }}>{periodLabel(c.period, c.payDays)}</td>
                    <td style={{ padding: '6px 8px', fontSize: '0.72rem', fontFamily: 'JetBrains Mono', color: 'var(--fg-muted)' }}>
                      {defaultIssueDateForPeriod(month, c.period, c.payDays)}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: '0.74rem', fontFamily: 'JetBrains Mono' }}>
                      {c.amount != null ? formatCopExact(c.amount) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: '0.74rem' }}>
                      {c.disabledReason ? (
                        <span style={{ color: 'var(--warning)' }}>{c.disabledReason}</span>
                      ) : (
                        ISSUER_LABELS[c.issuerKey!]
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          {done ? (
            <button className="btn-primary" onClick={onClose}>
              Ver cuentas emitidas
            </button>
          ) : (
            <>
              <button className="btn-ghost" onClick={onClose} disabled={emitting}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={() => void handleEmit()}
                disabled={emitting || candidates.length === 0 || Array.from(selected).length === 0}
              >
                {emitting ? 'Emitiendo...' : `Emitir seleccionadas (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
