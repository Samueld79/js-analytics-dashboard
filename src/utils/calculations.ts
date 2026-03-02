import type { ClientRecord } from "../data/clients";

export type AccountStatus =
  | "Sin Data"
  | "Alto Rendimiento"
  | "Rentable - Optimizable"
  | "Margen Bajo"
  | "No Rentable";

export type ClientMetrics = ClientRecord & {
  roas: number | null;
  estimatedProfit: number | null;
  status: AccountStatus;
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCop(value: number | null): string {
  if (value === null) return "—";
  return currencyFormatter.format(value);
}

export function formatRoas(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}x`;
}

export function getStatusByRoas(roas: number | null): AccountStatus {
  if (roas === null) return "Sin Data";
  if (roas >= 10) return "Alto Rendimiento";
  if (roas >= 4) return "Rentable - Optimizable";
  if (roas > 1) return "Margen Bajo";
  return "No Rentable";
}

export function buildClientMetrics(client: ClientRecord): ClientMetrics {
  const roas = client.sales === null ? null : client.sales / client.investment;
  const estimatedProfit = client.sales === null ? null : client.sales - client.investment;
  return {
    ...client,
    roas,
    estimatedProfit,
    status: getStatusByRoas(roas),
  };
}

export function sortByRoasDesc(clients: ClientMetrics[]): ClientMetrics[] {
  return [...clients].sort((a, b) => {
    if (a.roas === null && b.roas === null) return 0;
    if (a.roas === null) return 1;
    if (b.roas === null) return -1;
    return b.roas - a.roas;
  });
}
