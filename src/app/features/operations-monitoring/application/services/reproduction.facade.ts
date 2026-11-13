import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  currentDaysOpen, latestCalving, pregnancyInProgress, reproductiveTimeline, type ReproductiveHistory,
} from '../../domain/model/reproductive-history.model';
import { ReproductiveHistoryRepository } from '../../domain/repositories/reproductive-history.repository';

/** Coordinates the reproductive history of one female: the picker, her history and the figures derived from it. */
@Injectable()
export class ReproductionFacade {
  private readonly histories = inject(ReproductiveHistoryRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private cattleId: string | null = null;
  private historyRequest = 0;

  /** Females only, active ones first, each group by ear tag. */
  readonly females = signal<readonly MonitoredCattleSummary[]>([]);
  readonly animal = signal<MonitoredCattleSummary | null>(null);
  readonly history = signal<ReproductiveHistory | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Every dated event, newest first. */
  readonly timeline = computed(() => {
    const history = this.history();
    return history ? reproductiveTimeline(history) : [];
  });

  readonly pregnancy = computed(() => {
    const history = this.history();
    return history ? pregnancyInProgress(history) : null;
  });

  readonly daysOpen = computed(() => {
    const history = this.history();
    return history ? currentDaysOpen(history, new Date()) : null;
  });

  readonly lastCalving = computed(() => {
    const history = this.history();
    return history ? latestCalving(history) : null;
  });

  /** Loads the females of a ranch and, when one is named, her history; a null ranch clears the view. */
  async open(ranchId: string | null, cattleId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.cattleId = null;
    this.females.set([]);
    this.resetAnimal();
    if (!ranchId) return;
    await this.loadFemales(ranchId);
    if (cattleId) await this.selectAnimal(cattleId);
  }

  /** Shows one female's history; an id that is not a female of the ranch clears the selection. */
  async selectAnimal(cattleId: string | null): Promise<void> {
    this.cattleId = cattleId;
    this.resetAnimal();
    if (!cattleId) return;
    const animal = this.females().find(item => item.cattleId === cattleId) ?? null;
    this.animal.set(animal);
    if (!animal) return;
    await this.loadHistory();
  }

  /** Reloads the history of the selected female, for example after a record was saved from a dialog. */
  refresh(): Promise<void> {
    return this.loadHistory();
  }

  private resetAnimal(): void {
    this.animal.set(null);
    this.history.set(null);
    this.error.set(null);
  }

  private async loadFemales(ranchId: string): Promise<void> {
    try {
      const animals = await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY);
      if (ranchId === this.ranchId) this.females.set(femalesFirst(animals));
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadHistory(): Promise<void> {
    const ranchId = this.ranchId;
    const cattleId = this.cattleId;
    if (!ranchId || !cattleId) return;
    const request = ++this.historyRequest;
    this.loading.set(true);
    this.error.set(null);
    try {
      const history = await this.histories.get(ranchId, cattleId);
      if (request === this.historyRequest) this.history.set(history);
    } catch (error) {
      if (request === this.historyRequest) {
        this.history.set(null);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.historyRequest) this.loading.set(false);
    }
  }
}

/** Keeps the females only, with the active ones first, so the animals that need a record come first. */
function femalesFirst(animals: readonly MonitoredCattleSummary[]): MonitoredCattleSummary[] {
  return animals
    .filter(animal => animal.sex === 'Female')
    .sort((first, second) => {
      const activeFirst = Number(second.status === 'Active') - Number(first.status === 'Active');
      return activeFirst || first.earTag.localeCompare(second.earTag, undefined, { numeric: true });
    });
}
