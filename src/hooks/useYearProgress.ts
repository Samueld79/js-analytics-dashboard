import { useMemo } from 'react';

export interface YearProgressDay {
  date:     number;
  isPast:   boolean;
  isToday:  boolean;
  isFuture: boolean;
}

export interface YearProgressMonth {
  index:         number;
  label:         string;
  isCurrent:     boolean;
  leadingBlanks: number;
  days:          YearProgressDay[];
}

export interface YearProgressResult {
  year:           number;
  percent:        number;
  dayOfYear:      number;
  totalDays:      number;
  daysRemaining:  number;
  angleDeg:       number;
  months:         YearProgressMonth[];
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Monday-first weekday index (0 = Monday ... 6 = Sunday) for a given JS Date. */
function mondayFirstDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function useYearProgress(referenceDate: Date = new Date()): YearProgressResult {
  return useMemo(() => {
    const year = referenceDate.getFullYear();
    const totalDays = isLeapYear(year) ? 366 : 365;

    const startOfYear = new Date(year, 0, 1);
    const startOfToday = new Date(year, referenceDate.getMonth(), referenceDate.getDate());
    const dayOfYear = Math.round((startOfToday.getTime() - startOfYear.getTime()) / 86_400_000) + 1;

    const percent = Math.round((dayOfYear / totalDays) * 100);
    const daysRemaining = totalDays - dayOfYear;
    const angleDeg = (dayOfYear / totalDays) * 360;

    const months: YearProgressMonth[] = MONTH_LABELS.map((label, index) => {
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const leadingBlanks = mondayFirstDay(new Date(year, index, 1));

      const days: YearProgressDay[] = Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const thisDate = new Date(year, index, d);
        const isToday = thisDate.getTime() === startOfToday.getTime();
        const isPast = thisDate.getTime() < startOfToday.getTime();
        return { date: d, isPast, isToday, isFuture: !isPast && !isToday };
      });

      return {
        index,
        label,
        isCurrent: index === referenceDate.getMonth(),
        leadingBlanks,
        days,
      };
    });

    return { year, percent, dayOfYear, totalDays, daysRemaining, angleDeg, months };
  }, [referenceDate]);
}
