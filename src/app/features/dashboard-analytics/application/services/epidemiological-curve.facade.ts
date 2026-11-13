import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod } from '../../domain/model/analytics-period';
import { CURVE_CONDITIONS, type CurveCondition, type EpidemiologicalCurve } from '../../domain/model/epidemiological-curve.model';
import {
  attackRatePercent, cumulativeCases, dailyCases, movingAverage, peakDay, totalCases,
} from '../../domain/model/epidemiological-statistics';
import { EpidemiologicalCurveRepository } from '../../domain/repositories/epidemiological-curve.repository';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';

/** The rolling mean smooths weekday effects in case reporting, over one week. */
export const ROLLING_WINDOW_DAYS = 7;

/** The herd size comes from the dashboard because the curve has no population; if that read fails, the attack rate is unavailable. */
@Injectable()
export class EpidemiologicalCurveFacade {
  private readonly curves = inject(EpidemiologicalCurveRepository);
  private readonly indicators = inject(HerdIndicatorRepository);
  private ranchId: string | null = null;
  private request = 0;

  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly condition = signal<CurveCondition>(CURVE_CONDITIONS[0]);
  readonly curve = signal<EpidemiologicalCurve | null>(null);
  readonly herdSize = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly days = computed(() => dailyCases(this.curve()?.newCasesByDay ?? {}));
  readonly cumulative = computed(() => cumulativeCases(this.days()));
  readonly rollingAverage = computed(() => movingAverage(this.days().map(day => day.cases), ROLLING_WINDOW_DAYS));
  readonly total = computed(() => totalCases(this.days()));
  readonly peak = computed(() => peakDay(this.days()));
  readonly attackRate = computed(() => attackRatePercent(this.total(), this.herdSize()));

  async open(ranchId: string | null, period: AnalyticsPeriod): Promise<void> {
    this.ranchId = ranchId;
    this.period.set(period);
    await this.load();
  }

  async setCondition(condition: CurveCondition): Promise<void> {
    this.condition.set(condition);
    await this.load();
  }

  async setPeriod(period: AnalyticsPeriod): Promise<void> {
    this.period.set(period);
    await this.load();
  }

  private async load(): Promise<void> {
    const ranchId = this.ranchId;
    const request = ++this.request;
    if (!ranchId) {
      this.curve.set(null);
      this.herdSize.set(null);
      this.loading.set(false);
      return;
    }
    const period = this.period();
    const condition = this.condition();
    this.loading.set(true);
    this.error.set(null);
    try {
      const [curve, herdSize] = await Promise.all([
        this.curves.curve(ranchId, period, condition),
        this.readHerdSize(ranchId, period),
      ]);
      if (request === this.request) {
        this.curve.set(curve);
        this.herdSize.set(herdSize);
      }
    } catch (error) {
      if (request === this.request) {
        this.curve.set(null);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  private async readHerdSize(ranchId: string, period: AnalyticsPeriod): Promise<number | null> {
    try {
      return (await this.indicators.dashboard(ranchId, period)).monitoredAnimals.denominator;
    } catch {
      return null;
    }
  }
}
