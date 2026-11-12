import type { AnalyticsPeriod } from './analytics-period';
import type { ReportedPeriod } from './herd-indicators.model';

/** Metrics the API accepts as the `metric` query value; each one has its own unit. */
export const TREND_METRICS = ['body-temperature', 'activity-index', 'rumination-minutes'] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export interface TrendPoint {
  readonly cattleId: string;
  readonly recordedAt: string;
  readonly value: number;
}

/** The lot series of one metric; `outlierAnimals` are the animals whose averages lie beyond `outlierDeviation`. */
export interface TrendSeries {
  readonly ranchId: string;
  readonly lotId: string;
  readonly period: ReportedPeriod;
  readonly updatedAt: string;
  readonly source: string;
  readonly metric: string;
  readonly unit: string;
  readonly lotAverage: number | null;
  readonly outlierDeviation: number;
  readonly points: readonly TrendPoint[];
  readonly outlierAnimals: readonly string[];
  readonly missingReadings: number | null;
  readonly coverageReason: string | null;
  readonly unavailableReason: string | null;
}

/** One animal against its lot; the comparison needs at least five animals with valid readings. */
export interface AnimalComparison {
  readonly cattleId: string;
  readonly reference: TrendSeries;
  readonly animalAverage: number | null;
  readonly deviation: number | null;
  readonly referenceAnimalCount: number;
  readonly unavailableReason: string | null;
}

/** A lot read: `deviation` is the absolute distance, in the metric's unit, that marks an animal as an outlier. */
export interface TrendQuery {
  readonly lotId: string;
  readonly period: AnalyticsPeriod;
  readonly metric: TrendMetric;
  readonly deviation: number;
}
