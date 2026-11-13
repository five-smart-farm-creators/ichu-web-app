import type { AlertSeverity } from './alert.model';
import type { MonitoredMetric } from './telemetry.model';
import type { ThresholdBand } from './telemetry-statistics';

/** The productive stages ICHU registers for animals; a threshold is configured per stage and metric. */
export const THRESHOLD_LIFE_STAGES = ['Calf', 'Heifer', 'MilkingCow', 'FatteningBull'] as const;

export interface MonitoringThreshold {
  readonly thresholdId: string;
  readonly lifeStage: string;
  readonly metric: MonitoredMetric;
  readonly minValue: number;
  readonly maxValue: number;
  readonly severity: AlertSeverity;
  readonly revision: number;
}

export interface ConfigureThreshold {
  readonly lifeStage: string;
  readonly metric: MonitoredMetric;
  readonly minValue: number;
  readonly maxValue: number;
  readonly severity: AlertSeverity;
}

export function isValidThresholdRange(minValue: number, maxValue: number): boolean {
  return Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue < maxValue;
}

/** Finds the configured band for an animal's stage; without one, no threshold alert or band applies. */
export function thresholdBand(
  thresholds: readonly MonitoringThreshold[],
  lifeStage: string,
  metric: MonitoredMetric,
): ThresholdBand | null {
  const threshold = thresholds.find(item => item.lifeStage === lifeStage && item.metric === metric);
  return threshold ? { min: threshold.minValue, max: threshold.maxValue } : null;
}
