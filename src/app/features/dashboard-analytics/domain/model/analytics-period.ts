/** A half-open instant range, the same window the API reads: the start is included and the end is excluded. */
export interface AnalyticsPeriod {
  readonly from: Date;
  readonly to: Date;
}

/** Preset windows, in calendar days that end today. */
export const PERIOD_PRESET_DAYS = [7, 30, 90, 365] as const;
export type PeriodPresetDays = (typeof PERIOD_PRESET_DAYS)[number];

export const DEFAULT_PERIOD_DAYS: PeriodPresetDays = 30;

/** The last `days` calendar days in local time, today included. */
export function presetPeriod(days: number, now: Date): AnalyticsPeriod {
  return { from: startOfDay(addDays(now, 1 - days)), to: startOfDay(addDays(now, 1)) };
}

/** The days from `firstDay` to `lastDay`, both included; null when the last day comes before the first. */
export function customPeriod(firstDay: Date, lastDay: Date): AnalyticsPeriod | null {
  const from = startOfDay(firstDay);
  const to = startOfDay(addDays(lastDay, 1));
  return from < to ? { from, to } : null;
}

/** The local calendar day of an instant, as yyyy-MM-dd. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight of a local day written as yyyy-MM-dd. */
export function localDayStart(day: string): Date {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Moves by whole local calendar days, so a daylight-saving change never shifts the day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
