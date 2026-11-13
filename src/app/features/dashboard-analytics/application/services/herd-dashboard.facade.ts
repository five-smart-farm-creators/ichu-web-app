import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  type CollarConnectivity, IotAssetsContextFacade,
} from '../../../iot-assets/application/acl/iot-assets-context.facade';
import {
  OperationsMonitoringContextFacade, type RecentAlertSummary,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { PlanningContextFacade } from '../../../planning/application/acl/planning-context.facade';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod } from '../../domain/model/analytics-period';
import type { HerdIndicators } from '../../domain/model/herd-indicators.model';
import { type DailyLotBand, dailyLotBands } from '../../domain/model/trend-statistics';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { SPREAD_PROBE_DEVIATION } from './lot-trends.facade';

/** Upcoming work covers this many days ahead, the same window the planning reminders use. */
export const UPCOMING_WORK_DAYS = 7;

/** The dashboard lists only the newest alerts so the card stays short; the alerts page keeps the rest. */
export const RECENT_ALERT_COUNT = 3;

/** A scheduled activity as the dashboard lists it; `earTag` stays null for work that names no animal. */
export interface UpcomingWork {
  readonly title: string;
  readonly scheduledAt: string;
  readonly earTag: string | null;
}

/** An open alert as the dashboard lists it; `earTag` stays null when the animal is missing from the ranch's list. */
export interface RecentAlert extends Omit<RecentAlertSummary, 'cattleId'> {
  readonly earTag: string | null;
}

/** Loads the dashboard sections of the current ranch; each keeps its own error so one failure never blanks the page. */
@Injectable()
export class HerdDashboardFacade {
  private readonly indicators = inject(HerdIndicatorRepository);
  private readonly trends = inject(LotTrendRepository);
  private readonly planning = inject(PlanningContextFacade);
  private readonly cattle = inject(CattleInformationContextFacade);
  private readonly monitoring = inject(OperationsMonitoringContextFacade);
  private readonly iotAssets = inject(IotAssetsContextFacade);
  private ranchId: string | null = null;
  private indicatorRequest = 0;
  private upcomingRequest = 0;
  private alertRequest = 0;
  private collarRequest = 0;
  private temperatureRequest = 0;
  private earTagRead: {
    readonly ranchId: string;
    readonly tags: Promise<ReadonlyMap<string, string>>;
  } | null = null;

  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly report = signal<HerdIndicators | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly upcoming = signal<readonly UpcomingWork[]>([]);
  readonly upcomingError = signal<ApiError | null>(null);
  readonly alerts = signal<readonly RecentAlert[]>([]);
  readonly alertsError = signal<ApiError | null>(null);
  readonly collars = signal<CollarConnectivity | null>(null);
  readonly collarsError = signal<ApiError | null>(null);
  readonly temperatureLots = signal<readonly LotSummary[]>([]);
  readonly temperatureLotId = signal<string | null>(null);
  readonly temperature = signal<readonly DailyLotBand[]>([]);
  readonly temperatureUnit = signal('');
  readonly temperatureLimit = signal<number | null>(null);
  readonly temperatureUnavailable = signal<string | null>(null);
  readonly temperatureError = signal<ApiError | null>(null);
  readonly temperatureLoading = signal(false);

  /** Shows the indicators, upcoming work, alerts, collars and temperature of the period; a null ranch clears the view. */
  async open(ranchId: string | null, period: AnalyticsPeriod): Promise<void> {
    this.ranchId = ranchId;
    this.period.set(period);
    this.report.set(null);
    this.error.set(null);
    this.upcoming.set([]);
    this.upcomingError.set(null);
    this.alerts.set([]);
    this.alertsError.set(null);
    this.collars.set(null);
    this.collarsError.set(null);
    this.temperatureLots.set([]);
    this.temperatureLotId.set(null);
    this.clearTemperatureSeries();
    this.temperatureError.set(null);
    this.earTagRead = null;
    if (!ranchId) return;
    await Promise.all([
      this.loadIndicators(),
      this.loadUpcoming(ranchId),
      this.loadAlerts(ranchId),
      this.loadCollars(ranchId),
      this.loadTemperature(),
    ]);
  }

  /** Reads the indicators and the temperature again for another period; alerts and collars are current, not periodic. */
  async setPeriod(period: AnalyticsPeriod): Promise<void> {
    this.period.set(period);
    await Promise.all([this.loadIndicators(), this.loadTemperature()]);
  }

  /** Charts another lot; a lot the ranch no longer has falls back to the first one. */
  selectTemperatureLot(lotId: string): Promise<void> {
    this.temperatureLotId.set(lotId);
    return this.loadTemperature();
  }

  private async loadIndicators(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.indicatorRequest;
    const period = this.period();
    this.loading.set(true);
    this.error.set(null);
    try {
      const report = await this.indicators.dashboard(ranchId, period);
      if (request === this.indicatorRequest) this.report.set(report);
    } catch (error) {
      if (request === this.indicatorRequest) {
        this.report.set(null);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.indicatorRequest) this.loading.set(false);
    }
  }

  private async loadUpcoming(ranchId: string): Promise<void> {
    const request = ++this.upcomingRequest;
    this.upcomingError.set(null);
    try {
      const activities = await this.planning.upcomingActivities(ranchId, UPCOMING_WORK_DAYS);
      const earTags = activities.some(activity => activity.cattleId)
        ? await this.animalEarTags(ranchId)
        : new Map<string, string>();
      if (request !== this.upcomingRequest || ranchId !== this.ranchId) return;
      this.upcoming.set(activities.map(activity => ({
        title: activity.title,
        scheduledAt: activity.scheduledAt,
        earTag: activity.cattleId ? (earTags.get(activity.cattleId) ?? null) : null,
      })));
    } catch (error) {
      if (request === this.upcomingRequest) this.upcomingError.set(toApiError(error));
    }
  }

  private async loadAlerts(ranchId: string): Promise<void> {
    const request = ++this.alertRequest;
    this.alertsError.set(null);
    try {
      const summaries = await this.monitoring.recentAlerts(ranchId, RECENT_ALERT_COUNT);
      const earTags = summaries.length > 0
        ? await this.animalEarTags(ranchId)
        : new Map<string, string>();
      if (request !== this.alertRequest || ranchId !== this.ranchId) return;
      this.alerts.set(summaries.map(({ cattleId, ...alert }) => ({
        ...alert, earTag: earTags.get(cattleId) ?? null,
      })));
    } catch (error) {
      if (request === this.alertRequest && ranchId === this.ranchId) {
        this.alertsError.set(toApiError(error));
      }
    }
  }

  private async loadCollars(ranchId: string): Promise<void> {
    const request = ++this.collarRequest;
    this.collarsError.set(null);
    try {
      const collars = await this.iotAssets.collarConnectivity(ranchId);
      if (request === this.collarRequest && ranchId === this.ranchId) this.collars.set(collars);
    } catch (error) {
      if (request === this.collarRequest && ranchId === this.ranchId) {
        this.collarsError.set(toApiError(error));
      }
    }
  }

  /** The lot list is read with every temperature load, so a lot removed since the last load falls back to the first one. */
  private async loadTemperature(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.temperatureRequest;
    const period = this.period();
    this.temperatureLoading.set(true);
    this.temperatureError.set(null);
    try {
      const lots = await this.cattle.lotSummaries(ranchId);
      const selected = this.temperatureLotId();
      const lotId = lots.find(lot => lot.lotId === selected)?.lotId ?? lots[0]?.lotId ?? null;
      if (request !== this.temperatureRequest || ranchId !== this.ranchId) return;
      this.temperatureLots.set(lots);
      this.temperatureLotId.set(lotId);
      if (!lotId) {
        this.clearTemperatureSeries();
        return;
      }
      const [series, limit] = await Promise.all([
        this.trends.lotTrend(ranchId, {
          lotId, period, metric: 'body-temperature', deviation: SPREAD_PROBE_DEVIATION,
        }),
        this.monitoring.bodyTemperatureLimit(ranchId),
      ]);
      if (request !== this.temperatureRequest || ranchId !== this.ranchId) return;
      this.temperature.set(dailyLotBands(series.points));
      this.temperatureUnit.set(series.unit);
      this.temperatureUnavailable.set(series.unavailableReason);
      this.temperatureLimit.set(limit);
    } catch (error) {
      if (request === this.temperatureRequest && ranchId === this.ranchId) {
        this.clearTemperatureSeries();
        this.temperatureError.set(toApiError(error));
      }
    } finally {
      if (request === this.temperatureRequest) this.temperatureLoading.set(false);
    }
  }

  private clearTemperatureSeries(): void {
    this.temperature.set([]);
    this.temperatureUnit.set('');
    this.temperatureLimit.set(null);
    this.temperatureUnavailable.set(null);
  }

  /** One animal read per open serves the alert and upcoming labels; the ranch key keeps a late read from another ranch out. */
  private animalEarTags(ranchId: string): Promise<ReadonlyMap<string, string>> {
    if (this.earTagRead?.ranchId === ranchId) return this.earTagRead.tags;
    const tags = this.cattle.cattleSummaries(ranchId)
      .then(animals => new Map(animals.map(animal => [animal.cattleId, animal.earTag] as const)));
    this.earTagRead = { ranchId, tags };
    return tags;
  }
}
