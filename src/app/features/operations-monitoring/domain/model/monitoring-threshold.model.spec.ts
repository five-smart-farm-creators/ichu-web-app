import { isValidThresholdRange, type MonitoringThreshold, thresholdBand } from './monitoring-threshold.model';

const thresholds: MonitoringThreshold[] = [
  {
    thresholdId: 'threshold-1', lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38, maxValue: 39.5, severity: 'Warning', revision: 2,
  },
];

describe('monitoring thresholds', () => {
  it('requires finite limits with the minimum below the maximum', () => {
    expect(isValidThresholdRange(38, 39.5)).toBe(true);
    expect(isValidThresholdRange(39.5, 38)).toBe(false);
    expect(isValidThresholdRange(38, 38)).toBe(false);
    expect(isValidThresholdRange(Number.NaN, 39)).toBe(false);
  });

  it('returns the band configured for the stage and metric only', () => {
    expect(thresholdBand(thresholds, 'Calf', 'BodyTemperature')).toEqual({ min: 38, max: 39.5 });
    expect(thresholdBand(thresholds, 'Calf', 'ActivityIndex')).toBeNull();
    expect(thresholdBand(thresholds, 'Heifer', 'BodyTemperature')).toBeNull();
  });
});
