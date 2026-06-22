import { useMemo } from 'react';
import type { Client, DailySale, AdCampaignMetric } from '../lib/supabase';
import {
  aggregateCampaignMetricsByCampaign,
  aggregateCampaignMetricsByObjective,
} from '../services/adCampaignMetrics';
import { getCurrentMonthKey, getTodayStr, getWeekStart } from '../utils/goalHelpers';
import type { ClientCardData } from '../components/dashboard/ClientCard';
import type { BadgeStatus } from '../components/dashboard/StatBadge';

const OBJECTIVE_COLORS: Record<string, string> = {
  'Reconocimiento':       '#06b6d4',
  'Tráfico':              '#8b5cf6',
  'Interacción':          '#22c55e',
  'Ventas':               '#f59e0b',
  'Clientes Potenciales': '#3b82f6',
  'Presentación':         '#ec4899',
  'Evaluación':           '#10b981',
  'Otro':                 '#64748b',
};

interface UseClientDashboardDataInput {
  visibleClients: Client[];
  scopedSales:    DailySale[];
  campaignRows:   AdCampaignMetric[];
}

export function useClientDashboardData({
  visibleClients,
  scopedSales,
  campaignRows,
}: UseClientDashboardDataInput): ClientCardData[] {
  const currentMonthKey = getCurrentMonthKey();
  const todayStr        = getTodayStr();
  const weekStart       = getWeekStart();

  return useMemo((): ClientCardData[] => {
    const today = new Date();
    const dow      = today.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;

    // Previous month key
    const [y, m] = currentMonthKey.split('-').map(Number);
    const prevMonthKey = (() => {
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    // Previous week boundaries
    const prevWeekEnd   = (() => { const d = new Date(weekStart); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    const prevWeekStart = (() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();

    // ── Per-client sales aggregation ─────────────────────────────────────────
    const monthSalesMap    = new Map<string, number>();
    const weekSalesMap     = new Map<string, number>();
    const daySalesMap      = new Map<string, number>();
    const prevWeekSalesMap = new Map<string, number>();

    scopedSales.forEach((s) => {
      if (s.date.startsWith(currentMonthKey))
        monthSalesMap.set(s.client_id, (monthSalesMap.get(s.client_id) ?? 0) + s.total_sales);
      if (s.date >= weekStart && s.date <= todayStr)
        weekSalesMap.set(s.client_id, (weekSalesMap.get(s.client_id) ?? 0) + s.total_sales);
      if (s.date === todayStr)
        daySalesMap.set(s.client_id, (daySalesMap.get(s.client_id) ?? 0) + s.total_sales);
      if (s.date >= prevWeekStart && s.date <= prevWeekEnd)
        prevWeekSalesMap.set(s.client_id, (prevWeekSalesMap.get(s.client_id) ?? 0) + s.total_sales);
    });

    // ── Per-client campaign aggregation ──────────────────────────────────────
    type MonthCamp = { impressions: number; clicks: number; spend: number };
    const monthCampMap  = new Map<string, MonthCamp>();
    const weekSpendMap  = new Map<string, number>();
    const curRowsByClient  = new Map<string, AdCampaignMetric[]>();
    const prevRowsByClient = new Map<string, AdCampaignMetric[]>();

    campaignRows.forEach((r) => {
      if (r.date.startsWith(currentMonthKey)) {
        const prev = monthCampMap.get(r.client_id) ?? { impressions: 0, clicks: 0, spend: 0 };
        monthCampMap.set(r.client_id, {
          impressions: prev.impressions + (r.impressions ?? 0),
          clicks:      prev.clicks      + (r.clicks      ?? 0),
          spend:       prev.spend       + r.spend,
        });
        const arr = curRowsByClient.get(r.client_id) ?? [];
        arr.push(r);
        curRowsByClient.set(r.client_id, arr);
      }
      if (r.date.startsWith(prevMonthKey)) {
        const arr = prevRowsByClient.get(r.client_id) ?? [];
        arr.push(r);
        prevRowsByClient.set(r.client_id, arr);
      }
      if (r.date >= weekStart && r.date <= todayStr)
        weekSpendMap.set(r.client_id, (weekSpendMap.get(r.client_id) ?? 0) + r.spend);
    });

    // ── 8-week sparkline helper (ads spend) ──────────────────────────────────
    function spendSparkline(clientId: string): number[] {
      return Array.from({ length: 8 }, (_, i) => {
        const weeksAgo = 7 - i;
        const wS = new Date(today); wS.setDate(today.getDate() - daysToMon - weeksAgo * 7);
        const wE = new Date(wS);    wE.setDate(wS.getDate() + 6);
        const ws = wS.toISOString().slice(0, 10);
        const we = wE.toISOString().slice(0, 10);
        return campaignRows
          .filter((r) => r.client_id === clientId && r.date >= ws && r.date <= we)
          .reduce((sum, r) => sum + r.spend, 0);
      });
    }

    // ── Build cards ───────────────────────────────────────────────────────────
    return visibleClients
      .filter((c) => c.status !== 'churned')
      .map((c): ClientCardData => {
        const monthlySales  = monthSalesMap.get(c.id) ?? 0;
        const weekSales     = weekSalesMap.get(c.id) ?? 0;
        const daySales      = daySalesMap.get(c.id) ?? 0;
        const prevWeekSales = prevWeekSalesMap.get(c.id) ?? 0;
        const weekDelta     = prevWeekSales > 0 ? ((weekSales - prevWeekSales) / prevWeekSales) * 100 : null;

        const monthCamp    = monthCampMap.get(c.id);
        const monthSpend   = monthCamp?.spend ?? 0;
        const weekSpend    = weekSpendMap.get(c.id) ?? 0;
        const adsImpressions = monthCamp?.impressions ?? 0;
        const ctr = monthCamp && monthCamp.impressions > 0 ? (monthCamp.clicks / monthCamp.impressions) * 100 : null;
        const cpm = monthCamp && monthCamp.impressions > 0 ? (monthCamp.spend  / monthCamp.impressions) * 1000 : null;

        const curRows = curRowsByClient.get(c.id) ?? [];
        const prevRows = prevRowsByClient.get(c.id) ?? [];
        const campaignCount     = aggregateCampaignMetricsByCampaign(curRows).length;
        const campaignCountPrev = aggregateCampaignMetricsByCampaign(prevRows).length;
        const objectiveSplit    = aggregateCampaignMetricsByObjective(curRows);

        const campaignMix = objectiveSplit.map((o) => ({
          name:  o.objective,
          value: o.spend,
          color: OBJECTIVE_COLORS[o.objective] ?? '#64748b',
        }));

        const adSparkline = spendSparkline(c.id);

        // Badge
        const hasData = monthlySales > 0 || monthSpend > 0;
        let badge: BadgeStatus;
        if (!hasData) badge = 'inactivo';
        else if (c.monthly_goal && c.monthly_goal > 0) {
          const pct = monthlySales / c.monthly_goal;
          badge = pct >= 0.8 ? 'objetivo' : pct >= 0.5 ? 'riesgo' : 'accion';
        } else badge = 'objetivo';

        return {
          client: c,
          badge,
          monthlySales,
          daySales,
          weekSales,
          weekDelta,
          salesSparkline: [], // not used currently but required by interface
          monthSpend,
          weekSpend,
          adsImpressions,
          ctr,
          cpm,
          campaignCount,
          campaignCountPrev,
          adSparkline,
          campaignMix,
        };
      })
      .sort((a, b) => b.monthlySales - a.monthlySales);
  }, [visibleClients, scopedSales, campaignRows, currentMonthKey, todayStr, weekStart]);
}
