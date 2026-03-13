import { supabase } from '../lib/supabase';

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export function normalizeMoney(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeMonthDate(value?: string | null): string {
  const input = value?.trim();
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    return `${input}-01`;
  }

  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function isMissingRpcFunction(
  error: { code?: string; message?: string } | null | undefined,
  functionName: string,
): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.message?.includes(functionName) === true;
}
