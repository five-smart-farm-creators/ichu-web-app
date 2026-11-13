import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { Alert, AlertFilter } from '../../domain/model/alert.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { AlertRepository } from '../../domain/repositories/alert.repository';

export const ALERT_PAGE_SIZE = 25;

/** Exports stop at this many alerts so the browser never assembles an unbounded file. */
export const ALERT_EXPORT_LIMIT = 5000;

/** The API's largest page; exports read the filtered alerts in as few requests as possible. */
const EXPORT_PAGE_SIZE = 500;

/** Coordinates the alert queue of one ranch: filters, server paging, acknowledgement and exports. */
@Injectable()
export class AlertsFacade {
  private readonly alerts = inject(AlertRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly filter = signal<AlertFilter>({ status: null, cattleId: null });
  readonly pageIndex = signal(0);
  readonly pageSize = signal(ALERT_PAGE_SIZE);
  readonly rows = signal<readonly Alert[]>([]);
  readonly totalCount = signal(0);
  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  private readonly earTagById = computed(() => new Map(this.animals().map(animal => [animal.cattleId, animal.earTag] as const)));

  /** Shows the first page without filters; a null ranch clears the queue. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.filter.set({ status: null, cattleId: null });
    this.pageIndex.set(0);
    this.rows.set([]);
    this.totalCount.set(0);
    this.animals.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadAnimals(ranchId), this.loadPage()]);
  }

  search(filter: AlertFilter): Promise<void> {
    this.filter.set(filter);
    this.pageIndex.set(0);
    return this.loadPage();
  }

  goToPage(pageIndex: number, pageSize: number): Promise<void> {
    this.pageSize.set(pageSize);
    this.pageIndex.set(pageIndex);
    return this.loadPage();
  }

  /** Names the animal an alert belongs to; an animal that is no longer listed shows an empty name. */
  earTag(cattleId: string): string {
    return this.earTagById().get(cattleId) ?? '';
  }

  /**
   * Each attempt sends a new operation ID, so a retried request returns the stored result.
   * A stale version reloads the queue and fails with the shared version conflict code.
   */
  async acknowledge(alert: Alert, input: { readonly finding: string; readonly action: string | null }): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    try {
      await this.alerts.acknowledge(ranchId, alert.alertId, {
        operationId: crypto.randomUUID(),
        finding: input.finding,
        action: input.action,
        expectedVersion: alert.version,
      });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) await this.loadPage();
      throw apiError;
    }
    await this.loadPage();
  }

  /** Collects every alert of the current filter, up to the export limit. */
  async exportRows(): Promise<readonly Alert[]> {
    const ranchId = this.ranchId;
    if (!ranchId) return [];
    const rows: Alert[] = [];
    for (let page = 1; rows.length < ALERT_EXPORT_LIMIT; page++) {
      const batch = await this.alerts.list(ranchId, this.filter(), page, EXPORT_PAGE_SIZE);
      rows.push(...batch.items.slice(0, ALERT_EXPORT_LIMIT - rows.length));
      if (batch.items.length < EXPORT_PAGE_SIZE) break;
    }
    return rows;
  }

  private async loadAnimals(ranchId: string): Promise<void> {
    try {
      const animals = await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY);
      if (ranchId === this.ranchId) this.animals.set(animals);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadPage(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.alerts.list(ranchId, this.filter(), this.pageIndex() + 1, this.pageSize());
      if (request !== this.requestId) return;
      // An acknowledged alert leaves a Pending filter, so the last page can end up beyond the new count.
      const lastPage = Math.max(0, Math.ceil(page.totalCount / this.pageSize()) - 1);
      if (this.pageIndex() > lastPage) {
        this.pageIndex.set(lastPage);
        await this.loadPage();
        return;
      }
      this.rows.set(page.items);
      this.totalCount.set(page.totalCount);
    } catch (error) {
      if (request !== this.requestId) return;
      this.rows.set([]);
      this.totalCount.set(0);
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
