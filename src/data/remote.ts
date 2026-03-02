import type { ClientMonthlyData, MonthKey, MonthlyMetrics } from "./months";

export type RemoteMonthlyMetrics = Partial<{
  investment: number;
  sales: number | null;
  messages: number | null;
  reach: number | null;
  impressions: number | null;
}>;

export type RemoteClientMonthlyData = {
  clientName: string;
  months: Record<MonthKey, RemoteMonthlyMetrics>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMetrics(raw: unknown): MonthlyMetrics {
  if (!isObject(raw)) {
    throw new Error("JSON inválido: cada mes debe ser un objeto.");
  }

  const investment = typeof raw.investment === "number" && Number.isFinite(raw.investment)
    ? raw.investment
    : 0;

  return {
    investment,
    sales: toNullableNumber(raw.sales),
    messages: toNullableNumber(raw.messages),
    reach: toNullableNumber(raw.reach),
    impressions: toNullableNumber(raw.impressions),
  };
}

function validateAndNormalizePayload(payload: unknown): ClientMonthlyData[] {
  if (!Array.isArray(payload)) {
    throw new Error("JSON inválido: se esperaba un array.");
  }

  return payload.map((entry) => {
    if (!isObject(entry) || typeof entry.clientName !== "string" || !isObject(entry.months)) {
      throw new Error("JSON inválido: cada item debe tener clientName y months.");
    }

    const normalizedMonths: Record<MonthKey, MonthlyMetrics> = {};

    Object.entries(entry.months).forEach(([monthKey, metrics]) => {
      normalizedMonths[monthKey] = normalizeMetrics(metrics);
    });

    return {
      clientName: entry.clientName,
      months: normalizedMonths,
    };
  });
}

export async function fetchMonthlyData(url: string): Promise<ClientMonthlyData[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    return validateAndNormalizePayload(payload);
  } catch (error) {
    throw new Error(
      `No se pudo cargar la data remota: ${error instanceof Error ? error.message : "error desconocido"}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
