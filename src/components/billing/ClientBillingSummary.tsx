import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listClientBilling, listClientBillingPayments } from '../../services/billing';
import type { BillingInvoiceIssuerKey, BillingPaymentFrequency, BillingPaymentReceiver, ClientBilling, ClientBillingPayment } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';
import { getMonthLabel } from '../../utils/monthLabel';
import { periodLabel, periodsForFrequency } from '../../lib/billingPeriods';

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

function lastSixMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 10));
  }
  return months;
}

// Bloque resumido — SOLO se monta cuando el llamador ya confirmó role==='admin'
// (ver ClientDetailPage). client_billing / client_billing_payments tienen RLS
// admin-only, así que cualquier otro rol simplemente recibiría [] / error
// silencioso, pero la intención es que esta consulta ni se dispare para ellos.
export function ClientBillingSummary({ clientId }: { clientId: string }) {
  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [payments, setPayments] = useState<ClientBillingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [allBilling, allPayments] = await Promise.all([listClientBilling(), listClientBillingPayments()]);
      if (cancelled) return;
      setBilling(allBilling.find((b) => b.client_id === clientId) ?? null);
      setPayments(allPayments.filter((p) => p.client_id === clientId));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="card-glass card-padded">
        <p className="empty-note">Cargando facturación...</p>
      </div>
    );
  }

  const months = lastSixMonths();
  const paymentByMonthPeriod = new Map(payments.map((p) => [`${p.month.slice(0, 10)}:${p.period}`, p]));
  const periods = periodsForFrequency(billing?.payment_frequency);
  const isQuincenal = periods.length === 2;
  const fee = billing?.monthly_fee ?? null;
  const perPeriodAmount = fee != null ? (isQuincenal ? fee / 2 : fee) : null;
  const receiver = billing?.payment_receiver ?? null;

  return (
    <div className="card-glass card-padded">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="number-label">Facturación</div>
        <Link to="/admin/facturacion" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Editar en Facturación
        </Link>
      </div>

      {!billing || billing.monthly_fee == null ? (
        <p className="empty-note">Fee mensual sin definir todavía.</p>
      ) : (
        <div className="portal-kpi-card" style={{ marginBottom: 12 }}>
          <p className="portal-kpi-label">Fee mensual</p>
          <p className="portal-kpi-value">{formatCopExact(billing.monthly_fee)}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="meta-chip">
          Recibe: {receiver ? RECEIVER_LABELS[receiver] : 'Sin asignar'}
        </span>
        <span className="meta-chip">
          Modalidad: {billing?.payment_frequency ? FREQUENCY_LABELS[billing.payment_frequency] : '—'}
        </span>
        <span className="meta-chip">
          Emite: {billing?.invoice_issuer ? ISSUER_LABELS[billing.invoice_issuer] : 'Sin asignar'}
        </span>
      </div>

      {receiver === 'compartido' && perPeriodAmount != null && (
        <p style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 16 }}>
          Reparto 50/50{isQuincenal ? ' por quincena' : ''}: Samuel {formatCopExact(perPeriodAmount / 2)} · Juanca {formatCopExact(perPeriodAmount / 2)}
        </p>
      )}

      <p style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Últimos 6 meses
      </p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {months.map((month) => (
          <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {periods.map((period) => {
                const payment = paymentByMonthPeriod.get(`${month}:${period}`);
                const paid = payment?.status === 'pagado';
                return (
                  <span
                    key={period}
                    title={`${getMonthLabel(month)} · ${periodLabel(period, billing?.pay_days)} · ${paid ? 'Pagado' : 'Pendiente'}${paid ? (payment?.partner_paid ? ' · Pagado al socio' : ' · Pendiente de pasar al socio') : ''}`}
                    style={{
                      position: 'relative',
                      display: 'block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: paid ? 'var(--success)' : 'var(--warning)',
                    }}
                  >
                    {paid && payment?.partner_paid && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -3,
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: 'var(--cyan)',
                          border: '1px solid var(--surface)',
                        }}
                      />
                    )}
                  </span>
                );
              })}
            </div>
            <span style={{ fontSize: '0.56rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>
              {getMonthLabel(month).slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.56rem', color: 'var(--fg-muted)', marginTop: 8 }}>
        ● pagado · ● pendiente · <span style={{ color: 'var(--cyan)' }}>●</span> punto azul = ya se le pasó al socio
      </p>
    </div>
  );
}
