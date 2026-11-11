import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { CattleDeviceStatus, CattleProfile } from '../../domain/model/cattle-profile.model';
import {
  type ChangeLifeStage, type Cattle, type RecordExit, type UpdateCattle, VERSION_CONFLICT,
} from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';

/** Coordinates one animal's profile: loading, the three lifecycle writes and the lots it belongs to. */
@Injectable()
export class CattleProfileFacade {
  private readonly cattleRepository = inject(CattleRepository);
  private readonly lotRepository = inject(LotRepository);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly profile = signal<CattleProfile | null>(null);
  readonly lots = signal<readonly Lot[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly animal = computed<Cattle | null>(() => this.profile()?.cattle ?? null);
  readonly device = computed<CattleDeviceStatus | null>(() => this.profile()?.device ?? null);
  readonly lotNames = computed(() => {
    const animal = this.animal();
    if (!animal) return '';
    return this.lots()
      .filter(lot => lot.memberships.some(membership => membership.cattleId === animal.id))
      .map(lot => lot.name)
      .join(', ');
  });

  /** Loads the animal and its lots; a response for an animal or ranch that is no longer shown is discarded. */
  async load(ranchId: string | null, cattleId: string): Promise<void> {
    this.ranchId = ranchId;
    const request = ++this.requestId;
    if (!ranchId) return;
    if (this.animal()?.id !== cattleId) this.profile.set(null);
    this.loading.set(true);
    this.error.set(null);
    try {
      const [profile, lots] = await Promise.all([
        this.cattleRepository.profile(ranchId, cattleId),
        this.lotRepository.list(ranchId),
      ]);
      if (request !== this.requestId) return;
      this.profile.set(profile);
      this.lots.set(lots);
    } catch (error) {
      if (request !== this.requestId) return;
      this.profile.set(null);
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }

  /** Saves identification changes using the version that was loaded. */
  update(request: Omit<UpdateCattle, 'expectedVersion'>): Promise<void> {
    return this.write((ranchId, animal) =>
      this.cattleRepository.update(ranchId, animal.id, { ...request, expectedVersion: animal.version }));
  }

  /** Records a stage change; the returned animal replaces the loaded one, including its stage history. */
  changeLifeStage(request: Omit<ChangeLifeStage, 'expectedVersion'>): Promise<void> {
    return this.write((ranchId, animal) =>
      this.cattleRepository.changeLifeStage(ranchId, animal.id, { ...request, expectedVersion: animal.version }));
  }

  /** Records the exit; the animal becomes inactive and read-only from the returned record. */
  recordExit(request: Omit<RecordExit, 'expectedVersion'>): Promise<void> {
    return this.write((ranchId, animal) =>
      this.cattleRepository.recordExit(ranchId, animal.id, { ...request, expectedVersion: animal.version }));
  }

  /** A version conflict reloads the animal before the error reaches the dialog that asked for the change. */
  private async write(send: (ranchId: string, animal: Cattle) => Promise<Cattle>): Promise<void> {
    const ranchId = this.ranchId;
    const animal = this.animal();
    if (!ranchId || !animal) throw new ApiError(0, 'unknown', null);
    try {
      const updated = await send(ranchId, animal);
      this.profile.update(profile => (profile ? { ...profile, cattle: updated } : profile));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) await this.load(ranchId, animal.id);
      throw apiError;
    }
  }
}
