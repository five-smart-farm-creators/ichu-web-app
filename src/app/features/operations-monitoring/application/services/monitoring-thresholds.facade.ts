import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { ConfigureThreshold, MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';

/** Lists and configures the normal ranges of one ranch; saving a stage and metric replaces its previous band. */
@Injectable()
export class MonitoringThresholdsFacade {
  private readonly repository = inject(MonitoringThresholdRepository);
  private ranchId: string | null = null;

  readonly thresholds = signal<readonly MonitoringThreshold[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Loads the thresholds of a ranch; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.thresholds.set([]);
    this.error.set(null);
    if (!ranchId) return;
    this.loading.set(true);
    try {
      const thresholds = await this.repository.list(ranchId);
      if (ranchId === this.ranchId) this.thresholds.set(sortThresholds(thresholds));
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    } finally {
      if (ranchId === this.ranchId) this.loading.set(false);
    }
  }

  async configure(request: ConfigureThreshold): Promise<MonitoringThreshold> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    const saved = await this.repository.configure(ranchId, request);
    this.thresholds.update(thresholds => sortThresholds([
      ...thresholds.filter(item => item.lifeStage !== saved.lifeStage || item.metric !== saved.metric),
      saved,
    ]));
    return saved;
  }
}

function sortThresholds(thresholds: readonly MonitoringThreshold[]): MonitoringThreshold[] {
  return [...thresholds].sort((first, second) =>
    first.lifeStage.localeCompare(second.lifeStage) || first.metric.localeCompare(second.metric));
}
