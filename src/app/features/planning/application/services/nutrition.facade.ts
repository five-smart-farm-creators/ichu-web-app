import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  DashboardAnalyticsContextFacade, type LotMetricReading,
} from '../../../dashboard-analytics/application/acl/dashboard-analytics-context.facade';
import { type NutritionPlan, rationChangeDays, type RegisterNutritionPlan } from '../../domain/model/nutrition-plan.model';
import { localDay } from '../../domain/model/planning-time';
import {
  type DailyRumination, dailyRuminationMeans, type RuminationAroundChange, ruminationAroundChange, ruminationWindow,
} from '../../domain/model/rumination-evolution';
import { NutritionPlanRepository } from '../../domain/repositories/nutrition-plan.repository';

/** The lot's rumination over a window: its daily means, the ration changes inside it, and the means around the latest one. */
export interface RuminationEvolution {
  readonly from: Date;
  readonly to: Date;
  readonly days: readonly DailyRumination[];
  readonly changeDays: readonly string[];
  readonly around: RuminationAroundChange | null;
  readonly unavailableReason: string | null;
}

/** Coordinates the nutrition plans of one lot: the lot picker, the plan in force, the history, the rumination evolution and registrations. */
@Injectable()
export class NutritionFacade {
  private readonly plans = inject(NutritionPlanRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private readonly analytics = inject(DashboardAnalyticsContextFacade);
  private ranchId: string | null = null;
  private lotRequest = 0;

  readonly lots = signal<readonly LotSummary[]>([]);
  readonly lotId = signal<string | null>(null);
  /** Active animals of the lot, the basis of the feed estimate; null when the count could not be read. */
  readonly headCount = signal<number | null>(null);
  /** Newest first. */
  readonly history = signal<readonly NutritionPlan[]>([]);
  readonly current = signal<NutritionPlan | null>(null);
  readonly rumination = signal<RuminationEvolution | null>(null);
  readonly ruminationError = signal<ApiError | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly selectedLot = computed(() => this.lots().find(lot => lot.lotId === this.lotId()) ?? null);
  readonly changeDays = computed(() => rationChangeDays(this.history()));

  /** Loads the lots of a ranch and selects the named one, or the first one; a null ranch clears the view. */
  async open(ranchId: string | null, lotId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.lots.set([]);
    this.lotId.set(null);
    this.clearLot();
    if (!ranchId) return;
    await this.loadLots(ranchId);
    await this.selectLot(lotId ?? this.lots()[0]?.lotId ?? null);
  }

  /** Shows one lot's plans and rumination; an id that is not a lot of the ranch clears the selection. */
  async selectLot(lotId: string | null): Promise<void> {
    const lot = this.lots().find(item => item.lotId === lotId) ?? null;
    this.lotId.set(lot?.lotId ?? null);
    this.clearLot();
    if (lot) await this.loadLot();
  }

  /** Registers a plan for the selected lot and reloads the lot, so the plan in force and the history are current. */
  async register(request: RegisterNutritionPlan): Promise<void> {
    const ranchId = this.ranchId;
    const lotId = this.lotId();
    if (!ranchId || !lotId) throw new ApiError(0, 'configuration', null);
    await this.plans.register(ranchId, lotId, request);
    await this.loadLot();
  }

  private clearLot(): void {
    ++this.lotRequest;
    this.headCount.set(null);
    this.history.set([]);
    this.current.set(null);
    this.rumination.set(null);
    this.ruminationError.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  private async loadLots(ranchId: string): Promise<void> {
    try {
      const lots = await this.cattleContext.lotSummaries(ranchId);
      if (ranchId === this.ranchId) {
        this.lots.set([...lots].sort((first, second) => first.name.localeCompare(second.name)));
      }
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  /** Reads the plans, the plan in force and the active head count separately, so one failing read leaves the others readable. */
  private async loadLot(): Promise<void> {
    const ranchId = this.ranchId;
    const lotId = this.lotId();
    if (!ranchId || !lotId) return;
    const request = ++this.lotRequest;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [plans, current, heads] = await Promise.allSettled([
        this.plans.list(ranchId, lotId),
        this.plans.current(ranchId, lotId),
        this.cattleContext.monitoredCattle(ranchId, { activeOnly: true, lotId }, Number.POSITIVE_INFINITY),
      ]);
      if (request !== this.lotRequest) return;
      const failure = [plans, current, heads].find(result => result.status === 'rejected');
      this.history.set(plans.status === 'fulfilled'
        ? [...plans.value].sort((first, second) => second.validFrom.localeCompare(first.validFrom))
        : []);
      this.current.set(current.status === 'fulfilled' ? current.value : null);
      this.headCount.set(heads.status === 'fulfilled' ? heads.value.length : null);
      this.error.set(failure?.status === 'rejected' ? toApiError(failure.reason) : null);
      await this.loadRumination(ranchId, lotId, request);
    } finally {
      if (request === this.lotRequest) this.loading.set(false);
    }
  }

  /** The window opens before the current plan, so a ration change at its start falls inside the chart. */
  private async loadRumination(ranchId: string, lotId: string, request: number): Promise<void> {
    const period = ruminationWindow(new Date(), this.current()?.validFrom ?? null);
    this.ruminationError.set(null);
    try {
      const readings = await this.analytics.lotTrend(ranchId, lotId, 'rumination-minutes', period.from, period.to);
      if (request !== this.lotRequest) return;
      this.rumination.set(this.evolutionOf(period, readings.points, readings.unavailableReason));
    } catch (error) {
      if (request !== this.lotRequest) return;
      this.rumination.set(null);
      this.ruminationError.set(toApiError(error));
    }
  }

  /** Only the changes whose day falls inside the window are compared, and the chart marks each of them. */
  private evolutionOf(
    period: { readonly from: Date; readonly to: Date },
    readings: readonly LotMetricReading[],
    unavailableReason: string | null,
  ): RuminationEvolution {
    const firstDay = localDay(period.from);
    const endDay = localDay(period.to);
    const changeDays = [...this.changeDays()].filter(day => day >= firstDay && day < endDay).sort();
    const days = dailyRuminationMeans(readings);
    const latestChange = changeDays.at(-1);
    return {
      from: period.from,
      to: period.to,
      days,
      changeDays,
      around: latestChange ? ruminationAroundChange(days, latestChange) : null,
      unavailableReason,
    };
  }
}
