/** Milliseconds in one day; reminder and withdrawal counts are whole days. */
export const DAY_MILLISECONDS = 86_400_000;

/** Formats a local calendar day as yyyy-MM-dd, the form the planning dates use. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Reads a yyyy-MM-dd day as local midnight, so a date picker shows the day the API stored. */
export function parseLocalDay(day: string): Date {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth);
}

/** Moves by whole calendar days in local time, so a daylight-saving change never shifts the day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
