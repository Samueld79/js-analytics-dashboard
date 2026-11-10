import { formatCopExact } from '../../../lib/utils';
import { IncomeHero } from './IncomeHero';
import { PartnerSplitCard } from './PartnerSplitCard';
import { NetBalanceCard } from './NetBalanceCard';
import { MonthlyTrendChart } from './MonthlyTrendChart';
import { DueSoonList } from './DueSoonList';
import { UpcomingTimeline } from './UpcomingTimeline';
import type { DueItem, ReceiverTotals, TrendMonth } from './types';

interface Props {
  monthLabel: string;
  totals: {
    feeExpected: number;
    collected: number;
    pending: number;
    paidCount: number;
    pendingCount: number;
    feeUndefined: number;
    adSpendUnderManagement: number;
    byReceiver: Record<'samuel' | 'juanca' | 'compartido', ReceiverTotals>;
    owedBySamuelToJuanca: number;
    owedByJuancaToSamuel: number;
  };
  netBalance: {
    net: number;
    owedBySamuelToJuanca: number;
    owedByJuancaToSamuel: number;
    settlementCandidates: unknown[];
  };
  settlementHistory: { date: string; net: number }[];
  settling: boolean;
  settleError: string | null;
  onSettle: () => void;
  trend: TrendMonth[];
  dueNowItems: DueItem[];
  next7Items: DueItem[];
  todayIso: string;
  onRequestInvoice: (item: DueItem) => void;
}

// Dashboard de ingresos al inicio de /admin/facturacion. No recalcula nada:
// toda la data (totals, byReceiver, saldo neto, tendencia, vencimientos) se
// computa en FacturacionPage y llega lista por props — este componente solo
// la organiza en una cuadrícula responsive.
export function IncomeDashboard({
  monthLabel,
  totals,
  netBalance,
  settlementHistory,
  settling,
  settleError,
  onSettle,
  trend,
  dueNowItems,
  next7Items,
  todayIso,
  onRequestInvoice,
}: Props) {
  const paidPlusPending = totals.paidCount + totals.pendingCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
      <IncomeHero
        monthLabel={monthLabel}
        expected={totals.feeExpected}
        collected={totals.collected}
        pending={totals.pending}
        feeUndefinedCount={totals.feeUndefined}
      />

      <div className="portal-kpi-grid">
        <div className="card-glass portal-kpi-card">
          <p className="portal-kpi-label">Cobrado</p>
          <p className="portal-kpi-value">{formatCopExact(totals.collected)}</p>
          <p className="portal-kpi-sub">{totals.paidCount} cobro{totals.paidCount === 1 ? '' : 's'}</p>
        </div>
        <div className="card-glass portal-kpi-card">
          <p className="portal-kpi-label">Por cobrar</p>
          <p className="portal-kpi-value">{formatCopExact(totals.pending)}</p>
          <p className="portal-kpi-sub">{totals.pendingCount} cobro{totals.pendingCount === 1 ? '' : 's'}</p>
        </div>
        <div className="card-glass portal-kpi-card">
          <p className="portal-kpi-label">Cobros pagados vs. pendientes</p>
          <p className="portal-kpi-value">{totals.paidCount} de {paidPlusPending}</p>
          <p className="portal-kpi-sub">de este mes</p>
        </div>
        <div className="card-glass portal-kpi-card">
          <p className="portal-kpi-label">Inversión en pauta bajo gestión</p>
          <p className="portal-kpi-value">{formatCopExact(totals.adSpendUnderManagement)}</p>
          <p className="portal-kpi-sub">presupuesto mensual</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <PartnerSplitCard name="Samuel" accentVar="--cyan" totals={totals.byReceiver.samuel} />
        <PartnerSplitCard name="Juanca" accentVar="--color-accent-purple" totals={totals.byReceiver.juanca} />
        <NetBalanceCard
          net={netBalance.net}
          owedBySamuelToJuanca={netBalance.owedBySamuelToJuanca}
          owedByJuancaToSamuel={netBalance.owedByJuancaToSamuel}
          pendingSettlementsCount={netBalance.settlementCandidates.length}
          monthLabel={monthLabel}
          monthOwedBySamuelToJuanca={totals.owedBySamuelToJuanca}
          monthOwedByJuancaToSamuel={totals.owedByJuancaToSamuel}
          settling={settling}
          settleError={settleError}
          history={settlementHistory}
          onSettle={onSettle}
        />
      </div>

      <div className="card-glass card-padded">
        <p className="number-label" style={{ fontSize: '0.72rem', color: 'var(--fg)', marginBottom: 12 }}>Tendencia de 6 meses</p>
        <MonthlyTrendChart data={trend} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <DueSoonList items={dueNowItems} todayIso={todayIso} onRequestInvoice={onRequestInvoice} />
        <UpcomingTimeline items={next7Items} todayIso={todayIso} />
      </div>
    </div>
  );
}
