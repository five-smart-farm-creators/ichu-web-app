/** Joins a local day from a date picker and an HH:mm time from a time field into one instant; null until both are set. */
export function combineDayAndTime(day: Date | null, time: string | null): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(time ?? '');
  if (!day || !match) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]));
}

/** The current local time as HH:mm, the starting value of a time field. */
export function defaultTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
