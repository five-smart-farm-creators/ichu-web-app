import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade, type WithdrawalSummary } from '../../../planning/application/acl/planning-context.facade';
import {
  DAY_MILLISECONDS, type LivestockOperation, type OperationPeriod, type OperationType,
  type RecordClinicalIntervention, type RecordFieldEvent,
} from '../../domain/model/livestock-operation.model';
import { type LatestTelemetry } from '../../domain/model/telemetry.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';

export const HISTORY_PERIODS = ['90d', '1y', '5y'] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

const PERIOD_DAYS: Readonly<Record<HistoryPeriod, number>> = { '90d': 90, '1y': 365, '5y': 1825 };

/** Values an animal's health summary shows; a null field could not be read, which is never shown as zero. */
export interface AnimalHealthSummary {
  readonly latest: LatestTelemetry | null;
  readonly pendingAlerts: number | null;
  readonly withdrawal: WithdrawalSummary | null;
  readonly incomplete: boolean;
}

export type FieldEventInput = Omit<RecordFieldEvent, 'operationId'>;
export type ClinicalInterventionInput = Omit<RecordClinicalIntervention, 'operationId'>;

/** Coordinates the clinical history of one animal: the timeline, its period and type filter, the health summary and registrations. */
@Injectable()
export class ClinicalHistoryFacade {
  private readonly records = inject(LivestockOperationRepository);
  private readonly telemetry = inject(TelemetryRepository);
  private readonly alerts = inject(AlertRepository);
  private readonly planning = inject(PlanningContextFacade);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private cattleId: string | null = null;
  private historyRequest = 0;
  private summaryRequest = 0;
  private pendingAttempt: { readonly key: string; readonly operationId: string } | null = null;

  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  readonly animal = signal<MonitoredCattleSummary | null>(null);
  readonly period = signal<HistoryPeriod>('1y');
  readonly typeFilter = signal<OperationType | null>(null);
  readonly operations = signal<readonly LivestockOperation[]>([]);
  readonly window = signal<OperationPeriod | null>(null);
  readonly summary = signal<AnimalHealthSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Newest first, narrowed by the type filter. */
  readonly timeline = computed(() => {
    const type = this.typeFilter();
    return this.operations()
      .filter(operation => type === null || operation.type === type)
      .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt));
  });

  /** Loads the animals of a ranch and, when one is named, its history; a null ranch clears the view. */
  async open(ranchId: string | null, cattleId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.cattleId = null;
    this.animals.set([]);
    this.resetAnimal();
    if (!ranchId) return;
    await this.loadAnimals(ranchId);
    if (cattleId) await this.selectAnimal(cattleId);
  }

  /** Shows one animal's history and summary; a null id clears the selection. */
  async selectAnimal(cattleId: string | null): Promise<void> {
    this.cattleId = cattleId;
    this.resetAnimal();
    if (!cattleId) return;
    const animal = this.animals().find(item => item.cattleId === cattleId) ?? null;
    this.animal.set(animal);
    if (!animal) return;
    await Promise.all([this.loadHistory(), this.loadSummary()]);
  }

  async setPeriod(period: HistoryPeriod): Promise<void> {
    this.period.set(period);
    await this.loadHistory();
  }

  /** The period is already loaded, so narrowing by type needs no request. */
  setTypeFilter(type: OperationType | null): void {
    this.typeFilter.set(type);
  }

  registerFieldEvent(input: FieldEventInput): Promise<void> {
    const ranchId = this.requireSelection();
    return this.submit(input, operationId => this.records.registerFieldEvent(ranchId, { operationId, ...input }));
  }

  registerClinicalIntervention(input: ClinicalInterventionInput): Promise<void> {
    const ranchId = this.requireSelection();
    return this.submit(input, operationId => this.records.registerClinicalIntervention(ranchId, { operationId, ...input }));
  }

  /** Each new record gets a new operation ID; a retry of the same record reuses it, so a replay answered with 200 counts as saved. */
  private async submit(input: object, send: (operationId: string) => Promise<LivestockOperation>): Promise<void> {
    const key = JSON.stringify(input);
    const operationId = this.pendingAttempt?.key === key ? this.pendingAttempt.operationId : crypto.randomUUID();
    this.pendingAttempt = { key, operationId };
    await send(operationId);
    this.pendingAttempt = null;
    await Promise.all([this.loadHistory(), this.loadSummary()]);
  }

  private requireSelection(): string {
    if (!this.ranchId || !this.cattleId) throw new ApiError(0, 'configuration', null);
    return this.ranchId;
  }

  private resetAnimal(): void {
    this.animal.set(null);
    this.operations.set([]);
    this.window.set(null);
    this.summary.set(null);
    this.typeFilter.set(null);
    this.error.set(null);
  }

  private async loadAnimals(ranchId: string): Promise<void> {
    try {
      const animals = await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY);
      if (ranchId === this.ranchId) {
        this.animals.set([...animals].sort((first, second) => first.earTag.localeCompare(second.earTag, undefined, { numeric: true })));
      }
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadHistory(): Promise<void> {
    const ranchId = this.ranchId;
    const cattleId = this.cattleId;
    if (!ranchId || !cattleId) return;
    const request = ++this.historyRequest;
    const window = historyWindow(this.period(), new Date());
    this.window.set(window);
    this.loading.set(true);
    this.error.set(null);
    try {
      const operations = await this.records.list(ranchId, cattleId, window);
      if (request === this.historyRequest) this.operations.set(operations);
    } catch (error) {
      if (request === this.historyRequest) {
        this.operations.set([]);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.historyRequest) this.loading.set(false);
    }
  }

  /** Reads the three parts separately, so one failing part leaves the others readable. */
  private async loadSummary(): Promise<void> {
    const ranchId = this.ranchId;
    const cattleId = this.cattleId;
    if (!ranchId || !cattleId) return;
    const request = ++this.summaryRequest;
    const [latest, pending, withdrawals] = await Promise.allSettled([
      this.telemetry.latest(ranchId, cattleId),
      this.alerts.list(ranchId, { status: 'Pending', cattleId }, 1, 1),
      this.planning.withdrawalPeriodsFor(ranchId, cattleId),
    ]);
    if (request !== this.summaryRequest) return;
    this.summary.set({
      latest: latest.status === 'fulfilled' ? latest.value : null,
      pendingAlerts: pending.status === 'fulfilled' ? pending.value.totalCount : null,
      withdrawal: withdrawals.status === 'fulfilled' ? currentWithdrawal(withdrawals.value) : null,
      incomplete: [latest, pending, withdrawals].some(result => result.status === 'rejected'),
    });
  }
}

/** The period covers the chosen days up to tomorrow, so an entry registered today is included. */
function historyWindow(period: HistoryPeriod, now: Date): OperationPeriod {
  return {
    from: new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MILLISECONDS),
    to: new Date(now.getTime() + DAY_MILLISECONDS),
  };
}

/** The withdrawal in force now, or else the next one to start; an ended period is not the current one. */
function currentWithdrawal(periods: readonly WithdrawalSummary[]): WithdrawalSummary | null {
  return periods.find(period => period.state === 'Active') ?? periods.find(period => period.state === 'Upcoming') ?? null;
}
