import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { type MonitoringThreshold, thresholdBand } from '../../domain/model/monitoring-threshold.model';
import {
  type LatestTelemetry, measurementValue, type MonitoredMetric, type TelemetryPeriod, type TelemetryReading,
} from '../../domain/model/telemetry.model';
import { type SeriesStatistics, summarizeSeries, type ThresholdBand } from '../../domain/model/telemetry-statistics';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';

/** Readings beyond this count are not loaded, so one range cannot exhaust the browser. */
export const TELEMETRY_READING_LIMIT = 2000;

/** The API accepts up to 500 readings per page; the screens request 100 at a time. */
export const TELEMETRY_PAGE_SIZE = 100;

export interface TelemetryStatistics {
  readonly bodyTemperature: SeriesStatistics;
  readonly activityIndex: SeriesStatistics;
}

/** Coordinates one animal's monitoring page: latest values, thresholds and the readings of the chosen period. */
@Injectable()
export class CattleTelemetryFacade {
  private readonly telemetry = inject(TelemetryRepository);
  private readonly thresholdRepository = inject(MonitoringThresholdRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private cattleId: string | null = null;
  private readingsRequest = 0;

  readonly animal = signal<MonitoredCattleSummary | null>(null);
  readonly latest = signal<LatestTelemetry | null>(null);
  readonly thresholds = signal<readonly MonitoringThreshold[]>([]);
  readonly readings = signal<readonly TelemetryReading[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly truncated = computed(() => this.totalCount() > TELEMETRY_READING_LIMIT);
  readonly bodyTemperatureBand = computed(() => this.bandFor('BodyTemperature'));
  readonly activityIndexBand = computed(() => this.bandFor('ActivityIndex'));
  readonly statistics = computed<TelemetryStatistics>(() => {
    const readings = this.readings();
    return {
      bodyTemperature: summarizeSeries(readings.map(reading => measurementValue(reading.bodyTemperature)), this.bodyTemperatureBand()),
      activityIndex: summarizeSeries(readings.map(reading => measurementValue(reading.activityIndex)), this.activityIndexBand()),
    };
  });

  /** Loads the animal and its values for one period; a null ranch clears the page. */
  async open(ranchId: string | null, cattleId: string, period: TelemetryPeriod): Promise<void> {
    this.ranchId = ranchId;
    this.cattleId = cattleId;
    this.animal.set(null);
    this.latest.set(null);
    this.thresholds.set([]);
    this.readings.set([]);
    this.totalCount.set(0);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([
      this.loadAnimal(ranchId, cattleId),
      this.loadLatest(ranchId, cattleId),
      this.loadThresholds(ranchId),
      this.loadReadings(period),
    ]);
  }

  /** Replaces the readings with the most recent ones of another period; the API orders them by capture time. */
  loadReadings(period: TelemetryPeriod): Promise<void> {
    const ranchId = this.ranchId;
    const cattleId = this.cattleId;
    if (!ranchId || !cattleId) return Promise.resolve();
    const request = ++this.readingsRequest;
    return this.readPages(ranchId, cattleId, period, request);
  }

  private async readPages(ranchId: string, cattleId: string, period: TelemetryPeriod, request: number): Promise<void> {
    this.loading.set(true);
    try {
      const first = await this.telemetry.readings(ranchId, cattleId, period, 1, TELEMETRY_PAGE_SIZE);
      if (request !== this.readingsRequest) return;
      const total = first.totalCount;
      const lastPage = Math.max(1, Math.ceil(total / TELEMETRY_PAGE_SIZE));
      // Past the limit, the newest pages matter most, so reading starts that many pages before the end.
      const startPage = Math.max(1, lastPage - Math.ceil(TELEMETRY_READING_LIMIT / TELEMETRY_PAGE_SIZE) + 1);
      const collected: TelemetryReading[] = startPage === 1 ? [...first.items] : [];
      for (let page = Math.max(2, startPage); page <= lastPage; page++) {
        const batch = await this.telemetry.readings(ranchId, cattleId, period, page, TELEMETRY_PAGE_SIZE);
        if (request !== this.readingsRequest) return;
        if (batch.items.length === 0) break;
        collected.push(...batch.items);
      }
      this.totalCount.set(total);
      this.readings.set(collected.slice(-TELEMETRY_READING_LIMIT));
    } catch (error) {
      if (request !== this.readingsRequest) return;
      this.readings.set([]);
      this.totalCount.set(0);
      this.error.set(toApiError(error));
    } finally {
      if (request === this.readingsRequest) this.loading.set(false);
    }
  }

  private async loadAnimal(ranchId: string, cattleId: string): Promise<void> {
    try {
      const animal = await this.cattleContext.monitoredCattleById(ranchId, cattleId);
      if (this.isCurrent(ranchId, cattleId)) this.animal.set(animal);
    } catch (error) {
      if (this.isCurrent(ranchId, cattleId)) this.error.set(toApiError(error));
    }
  }

  private async loadLatest(ranchId: string, cattleId: string): Promise<void> {
    try {
      const latest = await this.telemetry.latest(ranchId, cattleId);
      if (this.isCurrent(ranchId, cattleId)) this.latest.set(latest);
    } catch (error) {
      if (this.isCurrent(ranchId, cattleId)) this.error.set(toApiError(error));
    }
  }

  private async loadThresholds(ranchId: string): Promise<void> {
    try {
      const thresholds = await this.thresholdRepository.list(ranchId);
      if (ranchId === this.ranchId) this.thresholds.set(thresholds);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private isCurrent(ranchId: string, cattleId: string): boolean {
    return ranchId === this.ranchId && cattleId === this.cattleId;
  }

  private bandFor(metric: MonitoredMetric): ThresholdBand | null {
    const animal = this.animal();
    return animal ? thresholdBand(this.thresholds(), animal.lifeStage, metric) : null;
  }
}
