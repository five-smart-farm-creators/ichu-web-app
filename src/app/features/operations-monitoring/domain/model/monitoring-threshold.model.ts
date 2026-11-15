import type { MonitoredMetric } from './telemetry.model';
import type { ThresholdBand } from './telemetry-statistics';

/** The productive stages ICHU registers for animals; a threshold is configured per stage and metric. */
export const THRESHOLD_LIFE_STAGES = ['Calf', 'Heifer', 'MilkingCow', 'FatteningBull'] as const;

/** The two levels a ranch configures per stage and metric; screens list Warning before Critical. */
export const THRESHOLD_SEVERITIES = ['Warning', 'Critical'] as const;
export type ThresholdSeverity = (typeof THRESHOLD_SEVERITIES)[number];

export interface MonitoringThreshold {
  readonly thresholdId: string;
  readonly lifeStage: string;
  readonly metric: MonitoredMetric;
  readonly minValue: number;
  readonly maxValue: number;
  readonly severity: ThresholdSeverity;
  readonly revision: number;
}

export interface ConfigureThreshold {
  readonly lifeStage: string;
  readonly metric: MonitoredMetric;
  readonly minValue: number;
  readonly maxValue: number;
  readonly severity: ThresholdSeverity;
}

export function isValidThresholdRange(minValue: number, maxValue: number): boolean {
  return Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue < maxValue;
}

/** Finds the band a stage and metric is measured against, preferring the Warning range because Critical is the wider one around it. */
export function thresholdBand(
  thresholds: readonly MonitoringThreshold[],
  lifeStage: string,
  metric: MonitoredMetric,
): ThresholdBand | null {
  const matching = thresholds.filter(item => item.lifeStage === lifeStage && item.metric === metric);
  const threshold = matching.find(item => item.severity === 'Warning')
    ?? matching.find(item => item.severity === 'Critical');
  return threshold ? { min: threshold.minValue, max: threshold.maxValue } : null;
}

/** Urgent means farther from normal, so a Critical range must contain the Warning range; a level not configured yet passes. */
export function levelsAreNested(thresholds: readonly MonitoringThreshold[], request: ConfigureThreshold): boolean {
  const otherSeverity: ThresholdSeverity = request.severity === 'Warning' ? 'Critical' : 'Warning';
  const other = thresholds.find(item =>
    item.lifeStage === request.lifeStage && item.metric === request.metric && item.severity === otherSeverity);
  if (!other) return true;
  const warning = request.severity === 'Warning' ? request : other;
  const critical = request.severity === 'Critical' ? request : other;
  return critical.minValue <= warning.minValue && critical.maxValue >= warning.maxValue;
}
