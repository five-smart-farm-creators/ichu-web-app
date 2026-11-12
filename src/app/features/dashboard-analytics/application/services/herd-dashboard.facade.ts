import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade } from '../../../planning/application/acl/planning-context.facade';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod } from '../../domain/model/analytics-period';
import type { HerdIndicators } from '../../domain/model/herd-indicators.model';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';

/** Upcoming work covers this many days ahead, the same window the planning reminders use. */
export const UPCOMING_WORK_DAYS = 7;

/** A scheduled activity as the dashboard lists it; `earTag` stays null for work that names no animal. */
export interface UpcomingWork {
  readonly title: string;
  readonly scheduledAt: string;
  readonly earTag: string | null;
}

/** Loads the herd indicators of a period and the work scheduled next for the current ranch. */
@Injectable()
export class HerdDashboardFacade {
  private readonly indicators = inject(HerdIndicatorRepository);
  private readonly planning = inject(PlanningContextFacade);
  private readonly cattle = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private indicatorRequest = 0;
  private upcomingRequest = 0;

  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly report = signal<HerdIndicators | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly upcoming = signal<readonly UpcomingWork[]>([]);
  readonly upcomingError = signal<ApiError | null>(null);

  /** Shows the indicators of the period and the upcoming work; a null ranch clears the view. */
  async open(ranchId: string | null, period: AnalyticsPeriod): Promise<void> {
    this.ranchId = ranchId;
    this.period.set(period);
    this.report.set(null);
    this.error.set(null);
    this.upcoming.set([]);
    this.upcomingError.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadIndicators(), this.loadUpcoming(ranchId)]);
  }

  /** Reads the indicators again for another period; upcoming work does not depend on the period. */
  setPeriod(period: AnalyticsPeriod): Promise<void> {
    this.period.set(period);
    return this.loadIndicators();
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
        ? new Map((await this.cattle.cattleSummaries(ranchId)).map(animal => [animal.cattleId, animal.earTag] as const))
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
}
