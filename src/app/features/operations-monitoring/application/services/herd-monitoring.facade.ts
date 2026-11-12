import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { LatestTelemetry } from '../../domain/model/telemetry.model';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { mapWithConcurrency } from './map-with-concurrency';

/** Herds above this size are narrowed by lot before any latest value is requested. */
export const HERD_LATEST_LIMIT = 200;

/** Latest-value requests in flight at once, so a large herd does not flood the API. */
export const HERD_REQUEST_CONCURRENCY = 4;

/** `failed` marks a value that could not be read, which is different from an animal without readings. */
export interface HerdRow {
  readonly animal: MonitoredCattleSummary;
  readonly latest: LatestTelemetry | null;
  readonly failed: boolean;
}

/** Loads the active animals of a ranch or one lot with their latest values, for the overview and the location map. */
@Injectable()
export class HerdMonitoringFacade {
  private readonly telemetry = inject(TelemetryRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly lots = signal<readonly LotSummary[]>([]);
  readonly lotId = signal<string | null>(null);
  readonly rows = signal<readonly HerdRow[]>([]);
  readonly tooManyAnimals = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Shows the active animals of a ranch; a null ranch clears the view. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.lotId.set(null);
    this.lots.set([]);
    this.rows.set([]);
    this.tooManyAnimals.set(false);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadLots(ranchId), this.loadRows()]);
  }

  /** Narrows the herd to one lot, or returns to every active animal when the lot is null. */
  selectLot(lotId: string | null): Promise<void> {
    this.lotId.set(lotId);
    return this.loadRows();
  }

  private async loadLots(ranchId: string): Promise<void> {
    try {
      const lots = await this.cattleContext.lotSummaries(ranchId);
      if (ranchId === this.ranchId) this.lots.set(lots);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  private async loadRows(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      // One animal beyond the limit reveals a larger herd without counting every animal.
      const animals = await this.cattleContext.monitoredCattle(
        ranchId,
        { activeOnly: true, lotId: this.lotId() },
        HERD_LATEST_LIMIT + 1,
      );
      if (request !== this.requestId) return;
      const tooMany = animals.length > HERD_LATEST_LIMIT;
      this.tooManyAnimals.set(tooMany);
      const rows = tooMany ? [] : await mapWithConcurrency(animals, HERD_REQUEST_CONCURRENCY, animal => this.readLatest(ranchId, animal));
      if (request !== this.requestId) return;
      this.rows.set(rows);
    } catch (error) {
      if (request !== this.requestId) return;
      this.rows.set([]);
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }

  private async readLatest(ranchId: string, animal: MonitoredCattleSummary): Promise<HerdRow> {
    try {
      return { animal, latest: await this.telemetry.latest(ranchId, animal.cattleId), failed: false };
    } catch {
      return { animal, latest: null, failed: true };
    }
  }
}
