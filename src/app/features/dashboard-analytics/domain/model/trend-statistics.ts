import { localDay } from './analytics-period';
import type { TrendPoint } from './lot-trend.model';

/** Mean of one animal's valid readings; every animal weighs the same in the lot average. */
export interface AnimalAverage {
  readonly cattleId: string;
  readonly average: number;
  readonly count: number;
}

/** Mean of one animal's readings on one local day. */
export interface AnimalDailyMean {
  readonly cattleId: string;
  readonly day: string;
  readonly value: number;
}

/** Lot value of one local day: the mean of the animals' daily means, so the day weighs animals equally. */
export interface DailyLotMean {
  readonly day: string;
  readonly value: number;
  readonly animalCount: number;
}

/** Lot value of one local day with its spread across animals; a single animal leaves the spread null. */
export interface DailyLotBand {
  readonly day: string;
  readonly mean: number;
  readonly spread: number | null;
  readonly animalCount: number;
}

/** Averages each animal's valid readings; non-finite values are skipped rather than counted as zero. */
export function animalAverages(points: readonly TrendPoint[]): AnimalAverage[] {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const total = totals.get(point.cattleId) ?? { sum: 0, count: 0 };
    total.sum += point.value;
    total.count += 1;
    totals.set(point.cattleId, total);
  }
  return [...totals].map(([cattleId, { sum, count }]) => ({ cattleId, average: sum / count, count }));
}

/** Sample standard deviation (n - 1); one value cannot measure spread, so it returns null. */
export function sampleStandardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  const squares = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

/** The absolute distance that counts as an outlier; null when the spread is missing or zero, so no animal stands apart. */
export function outlierThreshold(spread: number | null, multiplier: number): number | null {
  return spread !== null && spread > 0 && multiplier > 0 ? spread * multiplier : null;
}

/** Each animal's mean per local day, ordered by day and then by animal. */
export function animalDailyMeans(points: readonly TrendPoint[]): AnimalDailyMean[] {
  const totals = new Map<string, { cattleId: string; day: string; sum: number; count: number }>();
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const day = localDay(new Date(point.recordedAt));
    const key = `${day}|${point.cattleId}`;
    const total = totals.get(key) ?? { cattleId: point.cattleId, day, sum: 0, count: 0 };
    total.sum += point.value;
    total.count += 1;
    totals.set(key, total);
  }
  return [...totals.values()]
    .map(({ cattleId, day, sum, count }) => ({ cattleId, day, value: sum / count }))
    .sort((first, second) => first.day.localeCompare(second.day) || first.cattleId.localeCompare(second.cattleId));
}

/** The lot's daily mean: each day averages the animals' daily means, ordered by day. */
export function dailyLotMeans(points: readonly TrendPoint[]): DailyLotMean[] {
  return animalMeansByDay(points).map(({ day, values }) => ({
    day, value: average(values), animalCount: values.length,
  }));
}

/** Each day's lot mean with the spread across animals, which the temperature band draws as mean ± one standard deviation. */
export function dailyLotBands(points: readonly TrendPoint[]): DailyLotBand[] {
  return animalMeansByDay(points).map(({ day, values }) => ({
    day, mean: average(values), spread: sampleStandardDeviation(values), animalCount: values.length,
  }));
}

/** Groups each animal's daily mean by local day, ordered by day. */
function animalMeansByDay(points: readonly TrendPoint[]): { day: string; values: number[] }[] {
  const byDay = new Map<string, number[]>();
  for (const { day, value } of animalDailyMeans(points)) {
    const values = byDay.get(day) ?? [];
    values.push(value);
    byDay.set(day, values);
  }
  return [...byDay]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, values]) => ({ day, values }));
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
