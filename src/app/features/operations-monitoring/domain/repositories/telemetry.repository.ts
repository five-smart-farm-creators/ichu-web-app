import type { LatestTelemetry, TelemetryPage, TelemetryPeriod } from '../model/telemetry.model';

/** Reads the telemetry of animals; every call is scoped to one ranch. */
export abstract class TelemetryRepository {
  abstract latest(ranchId: string, cattleId: string): Promise<LatestTelemetry>;
  abstract readings(ranchId: string, cattleId: string, period: TelemetryPeriod, page: number, pageSize: number): Promise<TelemetryPage>;
}
