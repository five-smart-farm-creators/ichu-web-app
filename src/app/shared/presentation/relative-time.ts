const UNITS: readonly { readonly unit: Intl.RelativeTimeFormatUnit; readonly milliseconds: number }[] = [
  { unit: 'day', milliseconds: 86_400_000 },
  { unit: 'hour', milliseconds: 3_600_000 },
  { unit: 'minute', milliseconds: 60_000 },
];

/** Describes an instant relative to now in the given locale, using the largest whole unit that fits. */
export function relativeTime(instant: Date, now: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const elapsed = instant.getTime() - now.getTime();
  const unit = UNITS.find(candidate => Math.abs(elapsed) >= candidate.milliseconds);
  return unit
    ? formatter.format(Math.round(elapsed / unit.milliseconds), unit.unit)
    : formatter.format(0, 'minute');
}
