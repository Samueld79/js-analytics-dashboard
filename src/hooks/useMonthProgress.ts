import { useMemo } from 'react';

export interface MonthProgressResult {
  monthLabel:       string;
  percent:          number;
  dayOfMonth:       number;
  totalDaysInMonth: number;
  daysRemaining:    number;
}

export function useMonthProgress(referenceDate: Date = new Date()): MonthProgressResult {
  return useMemo(() => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const dayOfMonth = referenceDate.getDate();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const percent = Math.round((dayOfMonth / totalDaysInMonth) * 100);
    const daysRemaining = totalDaysInMonth - dayOfMonth;

    const raw = referenceDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);

    return { monthLabel, percent, dayOfMonth, totalDaysInMonth, daysRemaining };
  }, [referenceDate]);
}
