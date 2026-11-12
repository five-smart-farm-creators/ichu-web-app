/** Formats a measured value for display; a missing value reads as a dash, never as zero. */
export function formatMeasure(value: number | null | undefined, locale: string, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value);
}

/** A duration as a number and the unit key the template translates, such as `monitoring.duration.minutes`. */
export interface DurationParts {
  readonly amount: string;
  readonly unit: 'hours' | 'minutes' | 'seconds';
}

/** Expresses seconds in the largest whole unit that fits; null means the duration is unknown. */
export function durationParts(seconds: number | null, locale: string): DurationParts | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const amount = (value: number): string => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
  if (seconds >= 3600) return { amount: amount(seconds / 3600), unit: 'hours' };
  if (seconds >= 60) return { amount: amount(seconds / 60), unit: 'minutes' };
  return { amount: amount(seconds), unit: 'seconds' };
}
