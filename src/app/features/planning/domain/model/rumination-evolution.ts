import { addDays, localDay, parseLocalDay, startOfDay } from './planning-time';

/** A valid rumination reading of an animal of the lot, as the trend read returns it. */
export interface RuminationReading {
  readonly cattleId: string;
  readonly recordedAt: string;
  readonly value: number;
}

/** The lot's mean rumination on one local day; each animal weighs the same in its day. */
export interface DailyRumination {
  readonly day: string;
  readonly value: number;
  readonly animalCount: number;
}

/** The mean rumination before a ration change and from its day onward; null on a side without days. */
export interface RuminationAroundChange {
  readonly before: number | null;
  readonly after: number | null;
}

/** A half-open window of local time: the start is included and the end is excluded. */
export interface RuminationWindow {
  readonly from: Date;
  readonly to: Date;
}

/** Averages each animal's readings per local day, then the animals' means per day, so a day weighs animals equally. */
export function dailyRuminationMeans(readings: readonly RuminationReading[]): DailyRumination[] {
  const animalDays = new Map<string, { readonly day: string; sum: number; count: number }>();
  for (const reading of readings) {
    if (!Number.isFinite(reading.value)) continue;
    const day = localDay(new Date(reading.recordedAt));
    const key = `${day}|${reading.cattleId}`;
    const total = animalDays.get(key) ?? { day, sum: 0, count: 0 };
    total.sum += reading.value;
    total.count += 1;
    animalDays.set(key, total);
  }

  const means = new Map<string, number[]>();
  for (const { day, sum, count } of animalDays.values()) {
    means.set(day, [...(means.get(day) ?? []), sum / count]);
  }
  return [...means]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, values]) => ({ day, value: mean(values), animalCount: values.length }));
}

/** Compares the days before a change with the days from the change onward, by yyyy-MM-dd text. */
export function ruminationAroundChange(days: readonly DailyRumination[], changeDay: string): RuminationAroundChange {
  const before = days.filter(day => day.day < changeDay).map(day => day.value);
  const after = days.filter(day => day.day >= changeDay).map(day => day.value);
  return {
    before: before.length > 0 ? mean(before) : null,
    after: after.length > 0 ? mean(after) : null,
  };
}

/** Starts 30 days before the current plan so that its change is in view, but never more than 90 days back; without a plan, the last 30 days. */
export function ruminationWindow(today: Date, currentPlanStart: string | null): RuminationWindow {
  const to = addDays(startOfDay(today), 1);
  if (currentPlanStart === null) return { from: addDays(startOfDay(today), -29), to };
  const earliest = addDays(startOfDay(today), -90);
  const beforePlan = addDays(parseLocalDay(currentPlanStart), -30);
  return { from: beforePlan > earliest ? beforePlan : earliest, to };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
