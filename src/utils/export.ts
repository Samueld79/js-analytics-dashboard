import type { ClientMonthlyData } from "../data/months";

function toNullableRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function sanitizeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateClientCSV(client: ClientMonthlyData): string {
  const months = Object.keys(client.months).sort((a, b) => a.localeCompare(b));
  const header = "Mes,Inversión,Ventas,ROAS,Mensajes,Costo promedio por conversación,Alcance,Impresiones";
  const rows = months.map((month) => {
    const metrics = client.months[month];
    const roas = toNullableRatio(metrics.sales, metrics.investment);
    const cpr = toNullableRatio(metrics.investment, metrics.messages);

    return [
      month,
      metrics.investment,
      metrics.sales ?? "",
      roas === null ? "" : roas.toFixed(4),
      metrics.messages ?? "",
      cpr === null ? "" : cpr.toFixed(4),
      metrics.reach ?? "",
      metrics.impressions ?? "",
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv",
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
