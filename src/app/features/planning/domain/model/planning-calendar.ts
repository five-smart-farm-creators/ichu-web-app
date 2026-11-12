import { addDays, endOfDay, endOfMonth, localDay, startOfDay, startOfMonth } from './planning-time';

/** Reminders look this far back for overdue work and this far ahead for upcoming work. */
export const REMINDER_LOOKBACK_DAYS = 30;
export const REMINDER_LOOKAHEAD_DAYS = 7;

/** An inclusive instant range; the calendar API reads both ends. */
export interface PlanningPeriod {
  readonly from: Date;
  readonly to: Date;
}

/** One cell of the month grid, keyed by its local day. */
export interface CalendarDay {
  readonly day: string;
  readonly date: Date;
  readonly inMonth: boolean;
}

/** Builds six weeks so the grid keeps its height in every month; `firstDayOfWeek` is 0 for Sunday and 1 for Monday. */
export function monthGrid(visibleMonth: Date, firstDayOfWeek: 0 | 1): CalendarDay[][] {
  const first = startOfMonth(visibleMonth);
  const leading = (first.getDay() - firstDayOfWeek + 7) % 7;
  const start = addDays(first, -leading);
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, week * 7 + index);
    return { day: localDay(date), date, inMonth: date.getMonth() === first.getMonth() };
  }));
}

/** Covers every local day of the visible month. */
export function monthPeriod(visibleMonth: Date): PlanningPeriod {
  return { from: startOfMonth(visibleMonth), to: endOfMonth(visibleMonth) };
}

/** The reminder window: from the start of the day 30 days back to the end of the day 7 days ahead. */
export function reminderPeriod(now: Date): PlanningPeriod {
  return {
    from: startOfDay(addDays(now, -REMINDER_LOOKBACK_DAYS)),
    to: endOfDay(addDays(now, REMINDER_LOOKAHEAD_DAYS)),
  };
}
