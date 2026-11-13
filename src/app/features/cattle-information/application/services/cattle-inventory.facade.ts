import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { Cattle, CattleFilter, RegisterCattle } from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { readAllCattle } from './read-all-cattle';

/** Exports stop at this many animals so the browser never assembles an unbounded file. */
export const EXPORT_ROW_LIMIT = 5000;

export const CATTLE_PAGE_SIZE = 25;

/** Coordinates the animal inventory: filters, server paging, registration and export rows for one ranch. */
@Injectable()
export class CattleInventoryFacade {
  private readonly cattleRepository = inject(CattleRepository);
  private readonly lotRepository = inject(LotRepository);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly filter = signal<CattleFilter>({});
  readonly pageIndex = signal(0);
  readonly pageSize = signal(CATTLE_PAGE_SIZE);
  readonly rows = signal<readonly Cattle[]>([]);
  readonly hasNextPage = signal(false);
  readonly lots = signal<readonly Lot[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  private readonly lotNamesByCattle = computed(() => {
    const names = new Map<string, string[]>();
    for (const lot of this.lots()) {
      for (const membership of lot.memberships) {
        names.set(membership.cattleId, [...(names.get(membership.cattleId) ?? []), lot.name]);
      }
    }
    return names;
  });

  /** Shows the first page without filters; a null ranch clears the inventory. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.filter.set({});
    this.pageIndex.set(0);
    this.rows.set([]);
    this.hasNextPage.set(false);
    this.lots.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadLots(ranchId), this.loadPage()]);
  }

  /** Applies a new filter from the first page. */
  search(filter: CattleFilter): Promise<void> {
    this.filter.set(filter);
    this.pageIndex.set(0);
    return this.loadPage();
  }

  /** Moves to another server page; the page size travels with the page so the paginator stays in step. */
  goToPage(pageIndex: number, pageSize: number): Promise<void> {
    this.pageSize.set(pageSize);
    this.pageIndex.set(pageIndex);
    return this.loadPage();
  }

  /** Registers an animal in the current ranch and refreshes the page; the API decides whether the ear tag is free. */
  async register(request: RegisterCattle): Promise<Cattle> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    const created = await this.cattleRepository.register(ranchId, request);
    await this.loadPage();
    return created;
  }

  /** Names the lots that contain an animal, for the lot column. */
  lotNames(cattleId: string): string {
    return this.lotNamesByCattle().get(cattleId)?.join(', ') ?? '';
  }

  /** Collects every animal matching the current filter, up to the export limit. */
  exportRows(): Promise<readonly Cattle[]> {
    const ranchId = this.ranchId;
    if (!ranchId) return Promise.resolve([]);
    return readAllCattle(this.cattleRepository, ranchId, this.filter(), EXPORT_ROW_LIMIT);
  }

  private async loadLots(ranchId: string): Promise<void> {
    try {
      const lots = await this.lotRepository.list(ranchId);
      if (ranchId === this.ranchId) this.lots.set(lots);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadPage(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.requestId;
    const size = this.pageSize();
    this.loading.set(true);
    this.error.set(null);
    try {
      // One extra animal reveals whether another page exists without a separate count request.
      const batch = await this.cattleRepository.list(ranchId, this.filter(), this.pageIndex() + 1, size + 1);
      if (request !== this.requestId) return;
      this.rows.set(batch.slice(0, size));
      this.hasNextPage.set(batch.length > size);
    } catch (error) {
      if (request !== this.requestId) return;
      this.rows.set([]);
      this.hasNextPage.set(false);
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
