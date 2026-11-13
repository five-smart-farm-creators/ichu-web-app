import type { AnimalComparison, TrendQuery, TrendSeries } from '../model/lot-trend.model';

/** Reads the metric series of a lot and one animal's comparison with its lot. */
export abstract class LotTrendRepository {
  abstract lotTrend(ranchId: string, query: TrendQuery): Promise<TrendSeries>;
  abstract animalComparison(ranchId: string, cattleId: string, query: TrendQuery): Promise<AnimalComparison>;
}
