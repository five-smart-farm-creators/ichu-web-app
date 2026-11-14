export const ALERT_STATUSES = ['Pending', 'Acknowledged'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_TYPES = ['Temperature', 'Activity', 'HeartRate', 'Geofence'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['Informative', 'Warning', 'Critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** The finding and the action are each limited to this many characters by the API. */
export const ALERT_TEXT_MAX_LENGTH = 400;

/** An alert raised for an animal; `version` must accompany every acknowledgement. */
export interface Alert {
  readonly alertId: string;
  readonly cattleId: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly raisedAt: string;
  readonly detectedValue: number | null;
  readonly unit: string | null;
  readonly thresholdMinValue: number | null;
  readonly thresholdMaxValue: number | null;
  readonly geofenceId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly distanceToBoundaryMeters: number | null;
  readonly exitDurationSeconds: number | null;
  readonly acknowledgedAt: string | null;
  readonly finding: string | null;
  readonly action: string | null;
  readonly responseTimeSeconds: number | null;
  readonly version: number;
}

export interface AlertFilter {
  readonly status: AlertStatus | null;
  readonly cattleId: string | null;
}

export interface AlertPage {
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly items: readonly Alert[];
}

/** One attempt to acknowledge an alert; the operation ID makes a retried request return the stored result. */
export interface AcknowledgeAlert {
  readonly operationId: string;
  readonly finding: string;
  readonly action: string | null;
  readonly expectedVersion: number;
}
