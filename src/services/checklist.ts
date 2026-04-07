import { supabase } from '../lib/supabase';
import type { DailyChecklistEntry } from '../lib/supabase';

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeekRange(): { weekStart: string; weekEnd: string; daysElapsed: number } {
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Mon=1, Sun=7
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
    daysElapsed: dayOfWeek,
  };
}

export async function loadTodayEntries(
  today: string,
): Promise<{ data: DailyChecklistEntry[] | null; error: string | null }> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('daily_checklist')
    .select('*')
    .eq('date', today);
  return { data: data as DailyChecklistEntry[] | null, error: error?.message ?? null };
}

export async function loadWeekEntries(
  weekStart: string,
  weekEnd: string,
): Promise<{ data: Pick<DailyChecklistEntry, 'user_name' | 'date' | 'task_id' | 'task_points' | 'completed'>[] | null; error: string | null }> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from('daily_checklist')
    .select('user_name,date,task_id,task_points,completed')
    .gte('date', weekStart)
    .lte('date', weekEnd);
  return { data, error: error?.message ?? null };
}

export async function upsertEntry(
  entry: Omit<DailyChecklistEntry, 'id' | 'created_at'>,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase
    .from('daily_checklist')
    .upsert(entry, { onConflict: 'user_name,task_id,date' });
  return { error: error?.message ?? null };
}
