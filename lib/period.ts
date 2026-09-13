/**
 * Period normalization utilities.
 *
 * All Todos store a single `targetDate` field whose meaning depends on
 * `periodType`:
 *  - DAILY:  the exact date (UTC midnight)
 *  - WEEKLY: the Monday (ISO week start) of that date's week (UTC midnight)
 *  - YEARLY: January 1st of that date's year (UTC midnight)
 *
 * All calculations use UTC calendar components so results are deterministic
 * regardless of the host machine's local timezone.
 */
import type { PeriodType } from "./types";

export function normalizeDailyDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function normalizeWeekStart(date: Date): Date {
  const daily = normalizeDailyDate(date);
  const day = daily.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const isoDay = day === 0 ? 7 : day; // 1 = Monday ... 7 = Sunday
  const diffDays = isoDay - 1;
  const monday = new Date(daily);
  monday.setUTCDate(monday.getUTCDate() - diffDays);
  return monday;
}

export function normalizeYearStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export function normalizeForPeriod(date: Date, periodType: PeriodType): Date {
  switch (periodType) {
    case "DAILY":
      return normalizeDailyDate(date);
    case "WEEKLY":
      return normalizeWeekStart(date);
    case "YEARLY":
      return normalizeYearStart(date);
  }
}

export function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

export function yearEnd(yearStart: Date): Date {
  return new Date(Date.UTC(yearStart.getUTCFullYear() + 1, 0, 1));
}
