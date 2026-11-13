import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type CattleSummary, type LotMembersSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod } from '../../domain/model/analytics-period';
import type { AnimalComparison, TrendMetric, TrendSeries } from '../../domain/model/lot-trend.model';
import {
  animalAverages, outlierThreshold, sampleStandardDeviation,
} from '../../domain/model/trend-statistics';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';

/** The first read only measures the spread of the animals, so any positive deviation serves. */
export const SPREAD_PROBE_DEVIATION = 1;

/** The default outlier rule: an animal is flagged when its average lies two standard deviations from the lot average. */
export const DEFAULT_OUTLIER_MULTIPLIER = 2;

/** An animal the API flags, with its own average and how far it sits from the lot average. */
export interface OutlierAnimal {
  readonly cattleId: string;
  readonly earTag: string | null;
  readonly average: number | null;
  readonly deviation: number | null;
}

/** The API takes an absolute deviation in the metric's unit, so the lot is read once to measure its spread, then again with the threshold. */
@Injectable()
export class LotTrendsFacade {
  private readonly trends = inject(LotTrendRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private appliedPreference: string | null = null;
  private reference: Promise<void> = Promise.resolve();
  private referenceRequest = 0;
  private seriesRequest = 0;
  private comparisonRequest = 0;

  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly lots = signal<readonly LotMembersSummary[]>([]);
  readonly animals = signal<readonly CattleSummary[]>([]);
  readonly lotId = signal<string | null>(null);
  readonly cattleId = signal<string | null>(null);
  readonly metric = signal<TrendMetric>('body-temperature');
  readonly multiplier = signal(DEFAULT_OUTLIER_MULTIPLIER);
  readonly series = signal<TrendSeries | null>(null);
  readonly spread = signal<number | null>(null);
  readonly threshold = signal<number | null>(null);
  readonly comparison = signal<AnimalComparison | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly selectedLot = computed(() => this.lots().find(lot => lot.lotId === this.lotId()) ?? null);
  readonly earTagById = computed(() => new Map(this.animals().map(animal => [animal.cattleId, animal.earTag] as const)));
  readonly averages = computed(() => animalAverages(this.series()?.points ?? []));
  readonly outliers = computed<readonly OutlierAnimal[]>(() => {
    const series = this.series();
    if (!series) return [];
    const averageById = new Map(this.averages().map(item => [item.cattleId, item.average] as const));
    return series.outlierAnimals.map(cattleId => {
      const average = averageById.get(cattleId) ?? null;
      const lotAverage = series.lotAverage;
      return {
        cattleId,
        earTag: this.earTagById().get(cattleId) ?? null,
        average,
        deviation: average !== null && lotAverage !== null ? average - lotAverage : null,
      };
    });
  });

  /** Lots are read once per ranch; a preferred animal selects its lot once, so a later choice is not overwritten. */
  async open(ranchId: string | null, period: AnalyticsPeriod, preferredCattleId: string | null = null): Promise<void> {
    this.period.set(period);
    if (ranchId !== this.ranchId) {
      this.ranchId = ranchId;
      this.appliedPreference = null;
      this.resetSelection();
      this.reference = ranchId ? this.loadReference(ranchId) : Promise.resolve();
    }
    await this.reference;
    if (!this.ranchId) return;
    if (preferredCattleId && preferredCattleId !== this.appliedPreference) {
      this.appliedPreference = preferredCattleId;
      const lotId = this.lotContaining(preferredCattleId);
      if (lotId) {
        this.lotId.set(lotId);
        this.cattleId.set(preferredCattleId);
      }
    }
    if (!this.lots().some(lot => lot.lotId === this.lotId())) {
      this.lotId.set(this.lots()[0]?.lotId ?? null);
      this.cattleId.set(null);
    }
    await Promise.all([this.loadSeries(), this.loadComparison()]);
  }

  async selectLot(lotId: string): Promise<void> {
    this.lotId.set(lotId);
    const cattleId = this.cattleId();
    if (cattleId && !this.selectedLot()?.cattleIds.includes(cattleId)) this.cattleId.set(null);
    await this.refresh();
  }

  async selectMetric(metric: TrendMetric): Promise<void> {
    this.metric.set(metric);
    await this.refresh();
  }

  /** Changes the outlier rule; the series is read again because the threshold is part of the request. */
  setMultiplier(multiplier: number): Promise<void> {
    this.multiplier.set(multiplier);
    return this.loadSeries();
  }

  async setPeriod(period: AnalyticsPeriod): Promise<void> {
    this.period.set(period);
    await this.refresh();
  }

  selectAnimal(cattleId: string | null): Promise<void> {
    this.cattleId.set(cattleId);
    return this.loadComparison();
  }

  private async refresh(): Promise<void> {
    await Promise.all([this.loadSeries(), this.loadComparison()]);
  }

  private resetSelection(): void {
    this.lots.set([]);
    this.animals.set([]);
    this.lotId.set(null);
    this.cattleId.set(null);
    this.series.set(null);
    this.spread.set(null);
    this.threshold.set(null);
    this.comparison.set(null);
    this.error.set(null);
  }

  private lotContaining(cattleId: string): string | null {
    return this.lots().find(lot => lot.cattleIds.includes(cattleId))?.lotId ?? null;
  }

  private async loadReference(ranchId: string): Promise<void> {
    const request = ++this.referenceRequest;
    try {
      const [lots, animals] = await Promise.all([this.cattleContext.lotMembers(ranchId), this.cattleContext.cattleSummaries(ranchId)]);
      if (request === this.referenceRequest && ranchId === this.ranchId) {
        this.lots.set(lots);
        this.animals.set(animals);
      }
    } catch (error) {
      if (request === this.referenceRequest && ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadSeries(): Promise<void> {
    const ranchId = this.ranchId;
    const lotId = this.lotId();
    const request = ++this.seriesRequest;
    if (!ranchId || !lotId) {
      this.series.set(null);
      this.spread.set(null);
      this.threshold.set(null);
      this.loading.set(false);
      return;
    }
    const period = this.period();
    const metric = this.metric();
    this.loading.set(true);
    this.error.set(null);
    try {
      const probe = await this.trends.lotTrend(ranchId, { lotId, period, metric, deviation: SPREAD_PROBE_DEVIATION });
      if (request !== this.seriesRequest) return;
      const spread = sampleStandardDeviation(animalAverages(probe.points).map(item => item.average));
      const threshold = outlierThreshold(spread, this.multiplier());
      const series = threshold === null
        ? { ...probe, outlierAnimals: [] }
        : await this.trends.lotTrend(ranchId, { lotId, period, metric, deviation: threshold });
      if (request !== this.seriesRequest) return;
      this.spread.set(spread);
      this.threshold.set(threshold);
      this.series.set(series);
    } catch (error) {
      if (request === this.seriesRequest) {
        this.series.set(null);
        this.spread.set(null);
        this.threshold.set(null);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.seriesRequest) this.loading.set(false);
    }
  }

  private async loadComparison(): Promise<void> {
    const ranchId = this.ranchId;
    const lotId = this.lotId();
    const cattleId = this.cattleId();
    const request = ++this.comparisonRequest;
    if (!ranchId || !lotId || !cattleId) {
      this.comparison.set(null);
      return;
    }
    try {
      const comparison = await this.trends.animalComparison(ranchId, cattleId, {
        lotId,
        period: this.period(),
        metric: this.metric(),
        deviation: this.threshold() ?? SPREAD_PROBE_DEVIATION,
      });
      if (request === this.comparisonRequest) this.comparison.set(comparison);
    } catch (error) {
      if (request === this.comparisonRequest) {
        this.comparison.set(null);
        this.error.set(toApiError(error));
      }
    }
  }
}
