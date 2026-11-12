import { inject, Injectable } from '@angular/core';
import type { TrendMetric } from '../../domain/model/lot-trend.model';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';

/** One valid reading of a lot metric as other contexts read it: the animal, the instant and the value. */
export interface LotMetricReading {
  readonly cattleId: string;
  readonly recordedAt: string;
  readonly value: number;
}

/** The readings of one lot metric over a period; `unavailableReason` explains a series the API could not compute. */
export interface LotMetricReadings {
  readonly points: readonly LotMetricReading[];
  readonly unavailableReason: string | null;
}

/** The API requires a positive deviation, but this read never uses the outlier flags, so any positive value serves. */
const UNUSED_DEVIATION = 1;

/** Publishes the readings of a lot metric to other contexts, which never import this context's repositories or models. */
@Injectable()
export class DashboardAnalyticsContextFacade {
  private readonly trends = inject(LotTrendRepository);

  /** Reads the readings of a lot over a half-open period, without the lot average or the outlier flags. */
  async lotTrend(ranchId: string, lotId: string, metric: TrendMetric, from: Date, to: Date): Promise<LotMetricReadings> {
    const series = await this.trends.lotTrend(ranchId, {
      lotId, period: { from, to }, metric, deviation: UNUSED_DEVIATION,
    });
    return { points: series.points, unavailableReason: series.unavailableReason };
  }
}
