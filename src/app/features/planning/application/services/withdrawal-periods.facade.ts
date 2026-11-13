import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { RecordWithdrawalPeriod, WithdrawalPeriod } from '../../domain/model/withdrawal-period.model';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';

/** Lists the withdrawal periods of one ranch, narrowed by animal, and records new ones. */
@Injectable()
export class WithdrawalPeriodsFacade {
  private readonly periods = inject(WithdrawalPeriodRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  readonly cattleFilter = signal<string | null>(null);
  readonly rows = signal<readonly WithdrawalPeriod[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Loads the animals and the periods of a ranch; a null ranch clears the view. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.animals.set([]);
    this.cattleFilter.set(null);
    this.rows.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadAnimals(ranchId), this.load()]);
  }

  filterByCattle(cattleId: string | null): Promise<void> {
    this.cattleFilter.set(cattleId);
    return this.load();
  }

  /** Records a period and reloads the list with the current filter. */
  async record(request: RecordWithdrawalPeriod): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    await this.periods.record(ranchId, request);
    await this.load();
  }

  private async load(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const periods = await this.periods.list(ranchId, this.cattleFilter());
      if (request === this.requestId) this.rows.set(periods);
    } catch (error) {
      if (request === this.requestId) {
        this.rows.set([]);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }

  private async loadAnimals(ranchId: string): Promise<void> {
    try {
      const animals = await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY);
      if (ranchId === this.ranchId) this.animals.set(animals);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }
}
