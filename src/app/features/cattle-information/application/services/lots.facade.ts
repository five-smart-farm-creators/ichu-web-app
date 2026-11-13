import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { type Cattle, type CattleStatus, VERSION_CONFLICT } from '../../domain/model/cattle.model';
import type { CreateLot, Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { readAllCattle } from './read-all-cattle';

/** A lot member as the screen lists it; `earTag` is null only when the animal is missing from the ranch directory. */
export interface LotMember {
  readonly cattleId: string;
  readonly earTag: string | null;
  readonly status: CattleStatus | null;
  readonly assignedAt: string;
}

/** Coordinates lots: listing, creation, and adding or removing animals under the lot's version. */
@Injectable()
export class LotsFacade {
  private readonly lotRepository = inject(LotRepository);
  private readonly cattleRepository = inject(CattleRepository);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly lots = signal<readonly Lot[]>([]);
  readonly directory = signal<readonly Cattle[]>([]);
  readonly selectedLotId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly animalsById = computed(() => new Map(this.directory().map(animal => [animal.id, animal] as const)));
  readonly selectedLot = computed<Lot | null>(() =>
    this.lots().find(lot => lot.id === this.selectedLotId()) ?? null);
  readonly members = computed<readonly LotMember[]>(() => (this.selectedLot()?.memberships ?? []).map(membership => {
    const animal = this.animalsById().get(membership.cattleId);
    return {
      cattleId: membership.cattleId,
      earTag: animal?.earTag ?? null,
      status: animal?.status ?? null,
      assignedAt: membership.assignedAt,
    };
  }));
  readonly assignable = computed<readonly Cattle[]>(() => {
    const lot = this.selectedLot();
    if (!lot) return [];
    const memberIds = new Set(lot.memberships.map(membership => membership.cattleId));
    return this.directory().filter(animal => animal.status === 'Active' && !memberIds.has(animal.id));
  });

  /** Loads the ranch's lots and animals; a null ranch clears both. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.lots.set([]);
    this.directory.set([]);
    this.selectedLotId.set(null);
    this.error.set(null);
    if (!ranchId) return;
    await this.load(ranchId);
  }

  selectLot(lotId: string): void {
    this.selectedLotId.set(lotId);
  }

  /** Creates a lot and lists it by name, matching the API's order. */
  async create(request: CreateLot): Promise<Lot> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    const lot = await this.lotRepository.create(ranchId, request);
    this.lots.update(lots => [...lots, lot].sort((first, second) => first.name.localeCompare(second.name)));
    return lot;
  }

  /** Adds an animal to the selected lot; the API refuses inactive animals. */
  addAnimal(cattleId: string): Promise<void> {
    return this.changeMembership((ranchId, lot) => this.lotRepository.assignCattle(ranchId, lot.id, cattleId, lot.version));
  }

  /** Removes an animal from the selected lot; the animal's own record is kept. */
  removeAnimal(cattleId: string): Promise<void> {
    return this.changeMembership((ranchId, lot) => this.lotRepository.removeCattle(ranchId, lot.id, cattleId, lot.version));
  }

  /** A version conflict reloads the lots and animals before the error reaches the page. */
  private async changeMembership(send: (ranchId: string, lot: Lot) => Promise<Lot>): Promise<void> {
    const ranchId = this.ranchId;
    const lot = this.selectedLot();
    if (!ranchId || !lot) throw new ApiError(0, 'unknown', null);
    try {
      const updated = await send(ranchId, lot);
      this.lots.update(lots => lots.map(item => (item.id === updated.id ? updated : item)));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) await this.load(ranchId);
      throw apiError;
    }
  }

  private async load(ranchId: string): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [lots, directory] = await Promise.all([
        this.lotRepository.list(ranchId),
        readAllCattle(this.cattleRepository, ranchId, {}, Number.POSITIVE_INFINITY),
      ]);
      if (request !== this.requestId) return;
      this.lots.set(lots);
      this.directory.set(directory);
    } catch (error) {
      if (request !== this.requestId) return;
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
