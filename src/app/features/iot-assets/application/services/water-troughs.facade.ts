import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  OperationsMonitoringContextFacade, type WaterReadingsSummary, type WaterTroughStatusSummary,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import type { RegisterWaterTrough, TemperatureRange, WaterTrough } from '../../domain/model/water-trough.model';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';

/** The history dialog reads the readings of the last 24 hours. */
const HISTORY_PERIOD_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Coordinates the water troughs of one ranch: listing with lot names and controller status, registration and bands. */
@Injectable()
export class WaterTroughsFacade {
  private readonly troughRepository = inject(WaterTroughRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private readonly monitoring = inject(OperationsMonitoringContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly troughs = signal<readonly WaterTrough[]>([]);
  readonly lots = signal<readonly LotSummary[]>([]);
  readonly statuses = signal<readonly WaterTroughStatusSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly statusError = signal<ApiError | null>(null);
  private readonly lotNameById = computed(() => new Map(this.lots().map(lot => [lot.lotId, lot.name] as const)));
  private readonly statusById = computed(() =>
    new Map(this.statuses().map(status => [status.waterTroughId, status] as const)));

  /** Shows the ranch's troughs, lot names and statuses; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.troughs.set([]);
    this.lots.set([]);
    this.statuses.set([]);
    this.error.set(null);
    this.statusError.set(null);
    if (!ranchId) return;
    await this.load(ranchId);
  }

  /** Names the lot of a trough, or null when the trough has no lot or the lot is not loaded. */
  lotName(lotId: string | null): string | null {
    return lotId ? (this.lotNameById().get(lotId) ?? null) : null;
  }

  /** The controller status of a trough, or null while the statuses are missing because their read failed. */
  statusOf(waterTroughId: string): WaterTroughStatusSummary | null {
    return this.statusById().get(waterTroughId) ?? null;
  }

  /** Reads the last 24 hours of a controller's readings, oldest first. */
  readingsOf(controllerId: string): Promise<WaterReadingsSummary> {
    const to = new Date();
    const from = new Date(to.getTime() - HISTORY_PERIOD_MILLISECONDS);
    return this.monitoring.waterReadings(controllerId, { from, to });
  }

  async register(request: RegisterWaterTrough): Promise<WaterTrough> {
    const ranchId = this.requireRanch();
    const created = await this.troughRepository.register(ranchId, request);
    this.troughs.update(troughs => [...troughs, created].sort((first, second) => first.name.localeCompare(second.name)));
    // A new trough has no status until the statuses are read again.
    void this.loadStatuses(ranchId, this.requestId);
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
    // The range status depends on the band, so the statuses are read again after a save.
    void this.loadStatuses(ranchId, this.requestId);
  }

  private requireRanch(): string {
    if (!this.ranchId) throw new ApiError(0, 'unknown', null);
    return this.ranchId;
  }

  private async load(ranchId: string): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    await Promise.all([this.loadTroughs(ranchId, request), this.loadStatuses(ranchId, request)]);
    if (request === this.requestId) this.loading.set(false);
  }

  private async loadTroughs(ranchId: string, request: number): Promise<void> {
    try {
      const [troughs, lots] = await Promise.all([
        this.troughRepository.list(ranchId),
        this.cattleContext.lotSummaries(ranchId),
      ]);
      if (request !== this.requestId) return;
      this.troughs.set([...troughs].sort((first, second) => first.name.localeCompare(second.name)));
      this.lots.set(lots);
    } catch (error) {
      if (request === this.requestId) this.error.set(toApiError(error));
    }
  }

  /** Statuses load beside the troughs, so a failed read keeps the list visible behind a notice. */
  private async loadStatuses(ranchId: string, request: number): Promise<void> {
    try {
      const statuses = await this.monitoring.waterTroughStatuses(ranchId);
      if (request !== this.requestId) return;
      this.statuses.set(statuses);
      this.statusError.set(null);
    } catch (error) {
      if (request === this.requestId) this.statusError.set(toApiError(error));
    }
  }
}
