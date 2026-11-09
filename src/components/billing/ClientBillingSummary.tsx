import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listClientBilling } from '../../services/billing';
import type { ClientBilling } from '../../lib/supabase';
import { formatCopExact } from '../../lib/utils';

const PAYMENT_STATUS_LABEL: Record<ClientBilling['payment_status'], string> = {
  al_dia: 'Al día',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
  pausado: 'Pausado',
};

// Bloque resumido — SOLO se monta cuando el llamador ya confirmó role==='admin'
// (ver ClientDetailPage). client_billing tiene RLS admin-only, así que
// cualquier otro rol simplemente recibiría [] / error silencioso, pero la
// intención es que esta consulta ni se dispare para ellos.
export function ClientBillingSummary({ clientId }: { clientId: string }) {
  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = await listClientBilling();
      if (cancelled) return;
      setBilling(all.find((b) => b.client_id === clientId) ?? null);
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
        <div className="portal-kpi-grid">
          <div className="portal-kpi-card">
            <p className="portal-kpi-label">Fee mensual</p>
            <p className="portal-kpi-value">{formatCopExact(billing.monthly_fee)}</p>
            <p className="portal-kpi-sub">{billing.includes_ad_spend ? 'incluye pauta' : 'sin pauta incluida'}</p>
          </div>
          <div className="portal-kpi-card">
            <p className="portal-kpi-label">Estado de pago</p>
            <p className="portal-kpi-value" style={{ fontSize: '1rem' }}>{PAYMENT_STATUS_LABEL[billing.payment_status]}</p>
            <p className="portal-kpi-sub">{billing.billing_day ? `cobro día ${billing.billing_day}` : 'sin día de cobro'}</p>
          </div>
          <div className="portal-kpi-card">
            <p className="portal-kpi-label">Contrato</p>
            <p className="portal-kpi-value" style={{ fontSize: '0.95rem' }}>
              {billing.contract_start ?? '—'} → {billing.contract_end ?? '—'}
            </p>
          </div>
        </div>
      )}
      {billing?.notes && (
        <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--fg-2)' }}>{billing.notes}</p>
      )}
    </div>
  );
}
