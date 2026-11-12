/** Formats a number for display; a missing value reads as a dash, never as zero. */
export function formatAnalyticsNumber(value: number | null | undefined, locale: string, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value);
}

/** Writes a difference with its sign, so the direction reads without relying on color. */
export function formatSignedDifference(value: number | null, locale: string, fractionDigits = 2): string {
  if (value === null || !Number.isFinite(value)) return '–';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits, signDisplay: 'exceptZero' }).format(value);
}
