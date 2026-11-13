import type { ConfigureThreshold, MonitoringThreshold } from '../model/monitoring-threshold.model';

/** Lists and configures the normal ranges of one ranch. */
export abstract class MonitoringThresholdRepository {
  abstract list(ranchId: string): Promise<readonly MonitoringThreshold[]>;
  abstract configure(ranchId: string, request: ConfigureThreshold): Promise<MonitoringThreshold>;
}
