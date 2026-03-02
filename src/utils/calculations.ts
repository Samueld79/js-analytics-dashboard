import type { ClientMonthlyData, MonthKey, MonthlyMetrics } from "../data/months";

export type AccountStatus =
  | "Sin Data"
  | "Alto Rendimiento"
  | "Rentable - Optimizable"
  | "Margen Bajo"
  | "No Rentable";

export type ClientMetrics = {
  name: string;
  investment: number;
  sales: number | null;
  messages: number | null;
  reach: number | null;
  impressions: number | null;
  roas: number | null;
  cpr: number | null;
  estimatedProfit: number | null;
  status: AccountStatus;
  deltaInvestment: number | null;
  deltaSales: number | null;
  deltaRoas: number | null;
  deltaMessages: number | null;
  deltaCpr: number | null;
};

export type OverviewMetrics = {
  totalInvestment: number;
  totalReportedSales: number;
  globalRoas: number | null;
  totalMessages: number | null;
  weightedCpr: number | null;
  totalReach: number | null;
  totalImpressions: number | null;
  profitableCount: number;
  lossCount: number;
  noDataCount: number;
};

export type MonthlyOverviewPoint = {
  month: MonthKey;
  totalMessages: number | null;
  globalRoas: number | null;
};

export type MonthValuePoint = {
  month: MonthKey;
  value: number | null;
};

export type ClientSeries = {
  months: MonthKey[];
  sales: MonthValuePoint[];
  messages: MonthValuePoint[];
  reach: MonthValuePoint[];
  impressions: MonthValuePoint[];
  cpr: MonthValuePoint[];
};

export type ClientChartSeries = {
  salesPoints: MonthValuePoint[];
  messagesPoints: MonthValuePoint[];
  cprPoints: MonthValuePoint[];
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
});

const defaultMonthlyMetrics: MonthlyMetrics = {
  investment: 0,
  sales: null,
  messages: null,
  reach: null,
  impressions: null,
};

export function formatCop(value: number | null): string {
  if (value === null) return "—";
  return currencyFormatter.format(value);
}

export function formatInteger(value: number | null): string {
  if (value === null) return "—";
  return integerFormatter.format(value);
}

export function formatRoas(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${direction} ${Math.abs(value).toFixed(1)}%`;
}

export function getMonthLabel(monthKey: MonthKey): string {
  const [year, month] = monthKey.split("-");
  const monthDate = new Date(Number(year), Number(month) - 1, 1);
  const label = monthFormatter.format(monthDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getStatusByRoas(roas: number | null): AccountStatus {
  if (roas === null) return "Sin Data";
  if (roas >= 10) return "Alto Rendimiento";
  if (roas >= 4) return "Rentable - Optimizable";
  if (roas > 1) return "Margen Bajo";
  return "No Rentable";
}

export function sortByRoasDesc(clients: ClientMetrics[]): ClientMetrics[] {
  return [...clients].sort((a, b) => {
    if (a.roas === null && b.roas === null) return 0;
    if (a.roas === null) return 1;
    if (b.roas === null) return -1;
    return b.roas - a.roas;
  });
}

export function getAvailableMonths(data: ClientMonthlyData[]): MonthKey[] {
  const monthSet = new Set<MonthKey>();
  data.forEach((client) => {
    Object.keys(client.months).forEach((month) => monthSet.add(month));
  });
  return [...monthSet].sort((a, b) => a.localeCompare(b));
}

export function getPreviousMonth(months: MonthKey[], currentMonth: MonthKey): MonthKey | null {
  const currentIndex = months.indexOf(currentMonth);
  if (currentIndex <= 0) return null;
  return months[currentIndex - 1];
}

function getMonthData(client: ClientMonthlyData, month: MonthKey): MonthlyMetrics {
  return client.months[month] ?? defaultMonthlyMetrics;
}

function toNullableRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function toDeltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function sumNullable(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return valid.reduce((acc, value) => acc + value, 0);
}

export function buildClientMetricsForMonth(
  data: ClientMonthlyData[],
  month: MonthKey,
  previousMonth: MonthKey | null,
): ClientMetrics[] {
  return data.map((client) => {
    const current = getMonthData(client, month);
    const previous = previousMonth ? getMonthData(client, previousMonth) : null;

    const roas = toNullableRatio(current.sales, current.investment);
    const previousRoas = previous ? toNullableRatio(previous.sales, previous.investment) : null;

    const cpr = toNullableRatio(current.investment, current.messages);
    const previousCpr = previous ? toNullableRatio(previous.investment, previous.messages) : null;

    return {
      name: client.clientName,
      investment: current.investment,
      sales: current.sales,
      messages: current.messages,
      reach: current.reach,
      impressions: current.impressions,
      roas,
      cpr,
      estimatedProfit: current.sales === null ? null : current.sales - current.investment,
      status: getStatusByRoas(roas),
      deltaInvestment: previous ? toDeltaPercent(current.investment, previous.investment) : null,
      deltaSales: previous ? toDeltaPercent(current.sales, previous.sales) : null,
      deltaRoas: toDeltaPercent(roas, previousRoas),
      deltaMessages: previous ? toDeltaPercent(current.messages, previous.messages) : null,
      deltaCpr: toDeltaPercent(cpr, previousCpr),
    };
  });
}

export function getOverviewMetrics(clients: ClientMetrics[]): OverviewMetrics {
  const totalInvestment = clients.reduce((acc, client) => acc + client.investment, 0);
  const totalReportedSales = clients.reduce((acc, client) => acc + (client.sales ?? 0), 0);

  const totalMessages = sumNullable(clients.map((client) => client.messages));
  const totalReach = sumNullable(clients.map((client) => client.reach));
  const totalImpressions = sumNullable(clients.map((client) => client.impressions));

  return {
    totalInvestment,
    totalReportedSales,
    globalRoas: totalInvestment === 0 ? null : totalReportedSales / totalInvestment,
    totalMessages,
    weightedCpr:
      totalMessages === null || totalMessages === 0 ? null : totalInvestment / totalMessages,
    totalReach,
    totalImpressions,
    profitableCount: clients.filter((client) => client.roas !== null && client.roas > 1).length,
    lossCount: clients.filter((client) => client.roas !== null && client.roas <= 1).length,
    noDataCount: clients.filter((client) => client.roas === null).length,
  };
}

export function buildMonthlyOverviewSeries(data: ClientMonthlyData[]): MonthlyOverviewPoint[] {
  const months = getAvailableMonths(data);
  return months.map((month) => {
    const monthClients = data.map((client) => getMonthData(client, month));

    const totalInvestment = monthClients.reduce((acc, item) => acc + item.investment, 0);
    const totalSales = monthClients.reduce((acc, item) => acc + (item.sales ?? 0), 0);
    const totalMessages = sumNullable(monthClients.map((item) => item.messages));

    return {
      month,
      totalMessages,
      globalRoas: totalInvestment === 0 ? null : totalSales / totalInvestment,
    };
  });
}

export function getClientByName(
  data: ClientMonthlyData[],
  clientName: string,
): ClientMonthlyData | null {
  return data.find((item) => item.clientName === clientName) ?? null;
}

export function getSortedMonthsForClient(client: ClientMonthlyData): MonthKey[] {
  return Object.keys(client.months).sort((a, b) => a.localeCompare(b));
}

export function buildClientChartSeries(client: ClientMonthlyData): ClientChartSeries {
  const months = getSortedMonthsForClient(client);
  return {
    salesPoints: months.map((month) => ({ month, value: client.months[month]?.sales ?? null })),
    messagesPoints: months.map((month) => ({ month, value: client.months[month]?.messages ?? null })),
    cprPoints: months.map((month) => {
      const entry = client.months[month];
      if (!entry || entry.messages === null || entry.messages === 0) {
        return { month, value: null };
      }
      return { month, value: entry.investment / entry.messages };
    }),
  };
}

export function buildClientSeries(data: ClientMonthlyData[], clientName: string): ClientSeries {
  const client = getClientByName(data, clientName);
  if (!client) {
    return {
      months: [],
      sales: [],
      messages: [],
      reach: [],
      impressions: [],
      cpr: [],
    };
  }

  const months = getSortedMonthsForClient(client);
  const chartSeries = buildClientChartSeries(client);

  return {
    months,
    sales: chartSeries.salesPoints,
    messages: chartSeries.messagesPoints,
    reach: months.map((month) => ({ month, value: client.months[month]?.reach ?? null })),
    impressions: months.map((month) => ({ month, value: client.months[month]?.impressions ?? null })),
    cpr: chartSeries.cprPoints,
  };
}
