import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listClientBilling, listClientBillingPayments } from '../../services/billing';
import type { ClientBilling, ClientBillingPayment } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';
import { getMonthLabel } from '../../utils/monthLabel';

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
  const paymentByMonth = new Map(payments.map((p) => [p.month.slice(0, 10), p]));

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
        <div className="portal-kpi-card" style={{ marginBottom: 16 }}>
          <p className="portal-kpi-label">Fee mensual</p>
          <p className="portal-kpi-value">{formatCopExact(billing.monthly_fee)}</p>
        </div>
      )}

      <p style={{ fontSize: '0.64rem', color: 'var(--fg-muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Últimos 6 meses
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {months.map((month) => {
          const paid = paymentByMonth.get(month)?.status === 'pagado';
          return (
            <div key={month} title={`${getMonthLabel(month)} · ${paid ? 'Pagado' : 'Pendiente'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: paid ? 'var(--success)' : 'var(--warning)',
                }}
              />
              <span style={{ fontSize: '0.56rem', color: 'var(--fg-muted)', fontFamily: 'JetBrains Mono' }}>
                {getMonthLabel(month).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
