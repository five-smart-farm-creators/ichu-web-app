import { TestBed } from '@angular/core/testing';
import type { MonitoredCattleSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import type { LatestTelemetry, TelemetryMeasurement, TelemetryPeriod, TelemetryReading } from '../../domain/model/telemetry.model';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { CattleTelemetryFacade, TELEMETRY_READING_LIMIT } from './cattle-telemetry.facade';

const period: TelemetryPeriod = { from: new Date('2026-11-10T00:00:00Z'), to: new Date('2026-11-11T00:00:00Z') };

function measurement(value: number | null, unit: string): TelemetryMeasurement {
  return { value, unit, status: value === null ? 'Absent' : 'Valid', invalidReason: null };
}

function reading(index: number, temperature: number | null): TelemetryReading {
  return {
    readingId: `reading-${index}`,
    recordedAt: '2026-11-10T00:00:00Z',
    bodyTemperature: measurement(temperature, 'celsius'),
    activityIndex: measurement(10, 'index'),
    ruminationMinutes: measurement(null, 'minutes'),
    batteryLevel: measurement(80, 'percent'),
    position: { latitude: null, longitude: null, accuracyMeters: null, status: 'Absent', invalidReason: null },
  };
}

function page(items: TelemetryReading[], totalCount: number) {
  return { from: period.from.toISOString(), to: period.to.toISOString(), oldestRetainedRecordedAt: null, page: 1, pageSize: 100, totalCount, items };
}

const animal: MonitoredCattleSummary = { cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf' };
const latest = { cattleId: 'cattle-1' } as LatestTelemetry;
const calfFever: MonitoringThreshold = {
  thresholdId: 'threshold-1', lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38, maxValue: 39.5, severity: 'Warning', revision: 1,
};

describe('CattleTelemetryFacade', () => {
  let facade: CattleTelemetryFacade;
  let telemetry: { latest: ReturnType<typeof vi.fn>; readings: ReturnType<typeof vi.fn> };
  let thresholds: { list: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattleById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    telemetry = { latest: vi.fn(async () => latest), readings: vi.fn(async () => page([], 0)) };
    thresholds = { list: vi.fn(async () => [calfFever]) };
    cattleContext = { monitoredCattleById: vi.fn(async () => animal) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CattleTelemetryFacade,
        { provide: TelemetryRepository, useValue: telemetry },
        { provide: MonitoringThresholdRepository, useValue: thresholds },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(CattleTelemetryFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads every page of the period until the reported total is reached', async () => {
    telemetry.readings
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, index) => reading(index, 38)), 150))
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, index) => reading(100 + index, 38)), 150));

    await facade.open('ranch-1', 'cattle-1', period);

    expect(telemetry.readings).toHaveBeenCalledTimes(2);
    expect(telemetry.readings).toHaveBeenLastCalledWith('ranch-1', 'cattle-1', period, 2, 100);
    expect(facade.readings()).toHaveLength(150);
    expect(facade.truncated()).toBe(false);
  });

  it('keeps the most recent readings when the period passes the limit', async () => {
    telemetry.readings.mockImplementation(async () => page(Array.from({ length: 100 }, (_, index) => reading(index, 38)), 5000));

    await facade.open('ranch-1', 'cattle-1', period);

    expect(facade.readings()).toHaveLength(TELEMETRY_READING_LIMIT);
    expect(facade.totalCount()).toBe(5000);
    expect(facade.truncated()).toBe(true);
    // Page 1 reports the total; the newest 20 pages (31–50) follow.
    expect(telemetry.readings).toHaveBeenCalledTimes(1 + TELEMETRY_READING_LIMIT / 100);
    expect(telemetry.readings).toHaveBeenNthCalledWith(2, 'ranch-1', 'cattle-1', period, 31, 100);
    expect(telemetry.readings).toHaveBeenLastCalledWith('ranch-1', 'cattle-1', period, 50, 100);
  });

  it('measures body temperature against the band of the animal stage and ignores absent readings', async () => {
    telemetry.readings.mockResolvedValue(page([reading(1, 37), reading(2, 38.5), reading(3, 40), reading(4, null)], 4));

    await facade.open('ranch-1', 'cattle-1', period);

    expect(facade.bodyTemperatureBand()).toEqual({ min: 38, max: 39.5 });
    expect(facade.statistics().bodyTemperature.count).toBe(3);
    expect(facade.statistics().bodyTemperature.outsideBandPercent).toBeCloseTo(66.67, 1);
    expect(facade.statistics().activityIndex.outsideBandPercent).toBeNull();
  });

  it('keeps the readings of the previous period when a newer request replaces them', async () => {
    let resolveOld!: (value: unknown) => void;
    telemetry.readings
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce(page([reading(9, 38)], 1));
    const pending = facade.open('ranch-1', 'cattle-1', period);
    await facade.loadReadings({ from: period.from, to: new Date('2026-11-12T00:00:00Z') });
    resolveOld(page([reading(1, 37)], 1));
    await pending;

    expect(facade.readings().map(item => item.readingId)).toEqual(['reading-9']);
  });
});
