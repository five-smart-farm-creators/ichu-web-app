import { inject, Injectable } from '@angular/core';
import type { AlertSeverity, AlertType } from '../../domain/model/alert.model';
import {
  type ClinicalInterventionType, DAY_MILLISECONDS, isClinicalType,
} from '../../domain/model/livestock-operation.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';

/** A clinical intervention as Planning reads it: identity, animal, type and day, without the product or the author. */
export interface ClinicalInterventionSummary {
  readonly interventionId: string;
  readonly cattleId: string;
  readonly type: ClinicalInterventionType;
  readonly occurredAt: string;
}

/** An open alert as the dashboard reads it: what raised it, without the acknowledgement. */
export interface RecentAlertSummary {
  readonly alertId: string;
  readonly cattleId: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly raisedAt: string;
  readonly detectedValue: number | null;
  readonly unit: string | null;
  readonly distanceToBoundaryMeters: number | null;
}

/** The earliest day the history is read from, so every recorded intervention can be linked. */
const EARLIEST_RECORD = new Date('2000-01-01T00:00:00Z');

/** Publishes clinical interventions, open alerts and the body temperature limit to other contexts. */
@Injectable()
export class OperationsMonitoringContextFacade {
  private readonly operations = inject(LivestockOperationRepository);
  private readonly alerts = inject(AlertRepository);
  private readonly thresholds = inject(MonitoringThresholdRepository);

  /** Lists an animal's clinical interventions up to tomorrow, so an intervention registered today can be linked. */
  async interventionsFor(ranchId: string, cattleId: string): Promise<readonly ClinicalInterventionSummary[]> {
    const operations = await this.operations.list(ranchId, cattleId, {
      from: EARLIEST_RECORD,
      to: new Date(Date.now() + DAY_MILLISECONDS),
    });
    return operations.flatMap(operation => isClinicalType(operation.type)
      ? [{ interventionId: operation.operationId, cattleId: operation.cattleId, type: operation.type, occurredAt: operation.occurredAt }]
      : []);
  }

  /** Lists the newest pending alerts of the ranch; the API already orders them newest first. */
  async recentAlerts(ranchId: string, limit: number): Promise<readonly RecentAlertSummary[]> {
    const page = await this.alerts.list(ranchId, { status: 'Pending', cattleId: null }, 1, limit);
    return page.items.map(alert => ({
      alertId: alert.alertId,
      cattleId: alert.cattleId,
      type: alert.type,
      severity: alert.severity,
      raisedAt: alert.raisedAt,
      detectedValue: alert.detectedValue,
      unit: alert.unit,
      distanceToBoundaryMeters: alert.distanceToBoundaryMeters,
    }));
  }

  /** The lowest body temperature maximum: a lot mixes stages, and the limit line must not hide an alert of any of them. */
  async bodyTemperatureLimit(ranchId: string): Promise<number | null> {
    const maxima = (await this.thresholds.list(ranchId))
      .filter(threshold => threshold.metric === 'BodyTemperature')
      .map(threshold => threshold.maxValue);
    return maxima.length > 0 ? Math.min(...maxima) : null;
  }
}
