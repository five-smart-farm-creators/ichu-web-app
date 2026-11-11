import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import type { RegisterWaterTrough, TemperatureRange, WaterTrough } from '../../domain/model/water-trough.model';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';

/** Coordinates the water troughs of one ranch: listing with lot names, registration and temperature bands. */
@Injectable()
export class WaterTroughsFacade {
  private readonly troughRepository = inject(WaterTroughRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly troughs = signal<readonly WaterTrough[]>([]);
  readonly lots = signal<readonly LotSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  private readonly lotNameById = computed(() => new Map(this.lots().map(lot => [lot.lotId, lot.name] as const)));

  /** Shows the ranch's troughs and lot names; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.troughs.set([]);
    this.lots.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await this.load(ranchId);
  }

  /** Names the lot of a trough, or null when the trough has no lot or the lot is not loaded. */
  lotName(lotId: string | null): string | null {
    return lotId ? (this.lotNameById().get(lotId) ?? null) : null;
  }

  async register(request: RegisterWaterTrough): Promise<WaterTrough> {
    const ranchId = this.requireRanch();
    const created = await this.troughRepository.register(ranchId, request);
    this.troughs.update(troughs => [...troughs, created].sort((first, second) => first.name.localeCompare(second.name)));
    return created;
  }

  /** The band is saved against the trough's loaded version; a stale version reloads the troughs. */
  async configureTemperatureRange(waterTroughId: string, range: TemperatureRange): Promise<void> {
    const ranchId = this.requireRanch();
    const trough = this.troughs().find(item => item.id === waterTroughId);
    if (!trough) throw new ApiError(0, 'unknown', null);
    try {
      const updated = await this.troughRepository.configureTemperatureRange(ranchId, trough.id, {
        minimumCelsius: range.minimumCelsius,
        maximumCelsius: range.maximumCelsius,
        expectedVersion: trough.version,
      });
      this.troughs.update(troughs => troughs.map(item => (item.id === updated.id ? updated : item)));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) await this.load(ranchId);
      throw apiError;
    }
  }

  private requireRanch(): string {
    if (!this.ranchId) throw new ApiError(0, 'unknown', null);
    return this.ranchId;
  }

  private async load(ranchId: string): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [troughs, lots] = await Promise.all([
        this.troughRepository.list(ranchId),
        this.cattleContext.lotSummaries(ranchId),
      ]);
      if (request !== this.requestId) return;
      this.troughs.set([...troughs].sort((first, second) => first.name.localeCompare(second.name)));
      this.lots.set(lots);
    } catch (error) {
      if (request !== this.requestId) return;
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
