import { inject, Injectable } from '@angular/core';
import type { AlertSeverity, AlertType } from '../../domain/model/alert.model';
import {
  type ClinicalInterventionType, DAY_MILLISECONDS, isClinicalType,
} from '../../domain/model/livestock-operation.model';
import {
  type WaterControllerStatus, type WaterHeaterState, type WaterMeasurementStatus, type WaterRangeStatus,
  type WaterReading, type WaterReadingPeriod, waterTemperature,
} from '../../domain/model/water-status.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { WaterStatusRepository } from '../../domain/repositories/water-status.repository';

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

/** A water reading as the troughs screen reads it; `temperature` is null when the reading is invalid. */
export interface WaterReadingSummary {
  readonly capturedAt: string;
  readonly temperature: number | null;
  readonly isValid: boolean;
  readonly heaterState: WaterHeaterState;
}

/** The controller state and latest reading of a water trough, as the troughs screen reads them. */
export interface WaterTroughStatusSummary {
  readonly waterTroughId: string;
  readonly controllerId: string | null;
  readonly controllerStatus: WaterControllerStatus;
  readonly lastCommunicationAt: string | null;
  readonly measurementStatus: WaterMeasurementStatus;
  readonly rangeStatus: WaterRangeStatus;
  readonly latestReading: WaterReadingSummary | null;
}

/** The first page of a controller's readings; `totalCount` shows whether that page holds the whole period. */
export interface WaterReadingsSummary {
  readonly totalCount: number;
  readonly items: readonly WaterReadingSummary[];
}

/** The earliest day the history is read from, so every recorded intervention can be linked. */
const EARLIEST_RECORD = new Date('2000-01-01T00:00:00Z');

/** The API caps a page at 500 readings; reading one page keeps the history to a single request. */
const WATER_READING_PAGE_SIZE = 500;

/** Publishes clinical interventions, open alerts, the body temperature limit and water trough status to other contexts. */
@Injectable()
export class OperationsMonitoringContextFacade {
  private readonly operations = inject(LivestockOperationRepository);
  private readonly alerts = inject(AlertRepository);
  private readonly thresholds = inject(MonitoringThresholdRepository);
  private readonly waterStatus = inject(WaterStatusRepository);

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

  /** Lists the water trough statuses of the ranch, each with its controller and latest reading. */
  async waterTroughStatuses(ranchId: string): Promise<readonly WaterTroughStatusSummary[]> {
    const statuses = await this.waterStatus.troughStatuses(ranchId);
    return statuses.map(status => ({
      waterTroughId: status.waterTroughId,
      controllerId: status.controllerId,
      controllerStatus: status.controllerStatus,
      lastCommunicationAt: status.lastCommunicationAt,
      measurementStatus: status.measurementStatus,
      rangeStatus: status.rangeStatus,
      latestReading: status.latestReading ? waterReadingSummary(status.latestReading) : null,
    }));
  }

  /** Reads the first page of a controller's readings in a period, oldest first, with the period's total. */
  async waterReadings(controllerId: string, period: WaterReadingPeriod): Promise<WaterReadingsSummary> {
    const page = await this.waterStatus.readings(controllerId, period, 1, WATER_READING_PAGE_SIZE);
    return { totalCount: page.totalCount, items: page.items.map(waterReadingSummary) };
  }
}

/** Publishes a reading without its identifiers, gateway and receipt time; an invalid reading has no temperature. */
function waterReadingSummary(reading: WaterReading): WaterReadingSummary {
  return {
    capturedAt: reading.capturedAt,
    temperature: waterTemperature(reading),
    isValid: reading.isValid,
    heaterState: reading.heaterState,
  };
}
