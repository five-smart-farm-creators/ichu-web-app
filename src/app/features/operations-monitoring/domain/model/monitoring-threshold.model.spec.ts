import {
  type ConfigureThreshold, isValidThresholdRange, levelsAreNested, type MonitoringThreshold, thresholdBand,
} from './monitoring-threshold.model';

const warning: MonitoringThreshold = {
  thresholdId: 'threshold-1', lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38, maxValue: 39.5, severity: 'Warning', revision: 2,
};
const critical: MonitoringThreshold = { ...warning, thresholdId: 'threshold-2', minValue: 37, maxValue: 40, severity: 'Critical' };

describe('monitoring thresholds', () => {
  it('requires finite limits with the minimum below the maximum', () => {
    expect(isValidThresholdRange(38, 39.5)).toBe(true);
    expect(isValidThresholdRange(39.5, 38)).toBe(false);
    expect(isValidThresholdRange(38, 38)).toBe(false);
    expect(isValidThresholdRange(Number.NaN, 39)).toBe(false);
  });

  it('returns the band configured for the stage and metric only', () => {
    expect(thresholdBand([warning], 'Calf', 'BodyTemperature')).toEqual({ min: 38, max: 39.5 });
    expect(thresholdBand([warning], 'Calf', 'ActivityIndex')).toBeNull();
    expect(thresholdBand([warning], 'Heifer', 'BodyTemperature')).toBeNull();
  });

  it('measures against the Warning range even when the Critical range is listed first', () => {
    expect(thresholdBand([critical, warning], 'Calf', 'BodyTemperature')).toEqual({ min: 38, max: 39.5 });
  });

  it('falls back to the Critical range when no Warning range is configured', () => {
    expect(thresholdBand([critical], 'Calf', 'BodyTemperature')).toEqual({ min: 37, max: 40 });
  });

  it('requires a Critical range to contain the Warning range of the same stage and metric', () => {
    const criticalCandidate: ConfigureThreshold = {
      lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37, maxValue: 40, severity: 'Critical',
    };
    const warningCandidate: ConfigureThreshold = { ...criticalCandidate, minValue: 37.5, maxValue: 39.8, severity: 'Warning' };

    expect(levelsAreNested([warning], criticalCandidate)).toBe(true);
    expect(levelsAreNested([warning], { ...criticalCandidate, minValue: 38.5, maxValue: 39 })).toBe(false);
    expect(levelsAreNested([critical], warningCandidate)).toBe(true);
    expect(levelsAreNested([critical], { ...warningCandidate, minValue: 36 })).toBe(false);
  });

  it('passes a level when the other level is not configured or belongs to another metric', () => {
    const criticalCandidate: ConfigureThreshold = {
      lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38.5, maxValue: 39, severity: 'Critical',
    };

    expect(levelsAreNested([], criticalCandidate)).toBe(true);
    expect(levelsAreNested([{ ...warning, metric: 'HeartRate' }], criticalCandidate)).toBe(true);
  });
});
