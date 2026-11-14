/** Metrics that have normal ranges; the API uses these names in thresholds and alerts. */
export const MONITORED_METRICS = ['BodyTemperature', 'ActivityIndex', 'HeartRate', 'MethaneIndex'] as const;
export type MonitoredMetric = (typeof MONITORED_METRICS)[number];

/** A latest value is current, stale (captured more than 24 hours ago) or unavailable; an unavailable value is never zero. */
export type IndicatorState = 'current' | 'stale' | 'unavailable';

export interface LatestIndicator {
  readonly status: 'Available' | 'Unavailable';
  readonly value: number | null;
  readonly unit: string;
  readonly recordedAt: string | null;
  readonly isStale: boolean | null;
}

/** A historical observation of where the animal was, not a live location. */
export interface LastKnownPosition {
  readonly status: 'Available' | 'Unavailable';
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly recordedAt: string | null;
  readonly isStale: boolean | null;
}

export interface LatestTelemetry {
  readonly cattleId: string;
  readonly evaluatedAt: string;
  readonly lastReadingRecordedAt: string | null;
  readonly bodyTemperature: LatestIndicator;
  readonly heartRate: LatestIndicator;
  readonly activityIndex: LatestIndicator;
  readonly methaneIndex: LatestIndicator;
  readonly ruminationMinutes: LatestIndicator;
  readonly lastKnownPosition: LastKnownPosition;
}

export type MeasurementStatus = 'Valid' | 'Invalid' | 'Absent';

export interface TelemetryMeasurement {
  readonly value: number | null;
  readonly unit: string;
  readonly status: MeasurementStatus;
  readonly invalidReason: string | null;
}

export interface TelemetryPosition {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMeters: number | null;
  readonly status: MeasurementStatus;
  readonly invalidReason: string | null;
}

export interface TelemetryReading {
  readonly readingId: string;
  readonly recordedAt: string;
  readonly bodyTemperature: TelemetryMeasurement;
  readonly heartRate: TelemetryMeasurement;
  readonly activityIndex: TelemetryMeasurement;
  readonly methaneIndex: TelemetryMeasurement;
  readonly ruminationMinutes: TelemetryMeasurement;
  readonly batteryLevel: TelemetryMeasurement;
  readonly position: TelemetryPosition;
}

export interface TelemetryPage {
  readonly from: string;
  readonly to: string;
  readonly oldestRetainedRecordedAt: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly items: readonly TelemetryReading[];
}

/** A half-open time range: the start is included and the end is excluded. */
export interface TelemetryPeriod {
  readonly from: Date;
  readonly to: Date;
}

export function indicatorState(indicator: LatestIndicator): IndicatorState {
  if (indicator.status !== 'Available' || indicator.value === null) return 'unavailable';
  return indicator.isStale ? 'stale' : 'current';
}

/** Only a valid measurement carries a value; invalid or absent ones read as no value. */
export function measurementValue(measurement: TelemetryMeasurement): number | null {
  return measurement.status === 'Valid' ? measurement.value : null;
}
