import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { OperationsMonitoringContextFacade } from '../../application/acl/operations-monitoring-context.facade';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { GeofenceRepository } from '../../domain/repositories/geofence.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { ReproductiveHistoryRepository } from '../../domain/repositories/reproductive-history.repository';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { RestAlertRepository } from '../repositories/rest-alert.repository';
import { RestGeofenceRepository } from '../repositories/rest-geofence.repository';
import { RestLivestockOperationRepository } from '../repositories/rest-livestock-operation.repository';
import { RestMonitoringThresholdRepository } from '../repositories/rest-monitoring-threshold.repository';
import { RestReproductiveHistoryRepository } from '../repositories/rest-reproductive-history.repository';
import { RestTelemetryRepository } from '../repositories/rest-telemetry.repository';

/** Composes the REST adapters and the ACL facade of the operations and monitoring context for a lazy route group. */
export function provideOperationsMonitoring(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestTelemetryRepository,
    { provide: TelemetryRepository, useExisting: RestTelemetryRepository },
    RestAlertRepository,
    { provide: AlertRepository, useExisting: RestAlertRepository },
    RestGeofenceRepository,
    { provide: GeofenceRepository, useExisting: RestGeofenceRepository },
    RestMonitoringThresholdRepository,
    { provide: MonitoringThresholdRepository, useExisting: RestMonitoringThresholdRepository },
    RestLivestockOperationRepository,
    { provide: LivestockOperationRepository, useExisting: RestLivestockOperationRepository },
    RestReproductiveHistoryRepository,
    { provide: ReproductiveHistoryRepository, useExisting: RestReproductiveHistoryRepository },
    OperationsMonitoringContextFacade,
  ]);
}
