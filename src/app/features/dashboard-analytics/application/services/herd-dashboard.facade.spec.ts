import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { IotAssetsContextFacade } from '../../../iot-assets/application/acl/iot-assets-context.facade';
import {
  OperationsMonitoringContextFacade, type RecentAlertSummary,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { PlanningContextFacade } from '../../../planning/application/acl/planning-context.facade';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { HerdIndicators, IndicatorValue } from '../../domain/model/herd-indicators.model';
import type { TrendPoint, TrendSeries } from '../../domain/model/lot-trend.model';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { HerdDashboardFacade, RECENT_ALERT_COUNT, UPCOMING_WORK_DAYS } from './herd-dashboard.facade';
import { SPREAD_PROBE_DEVIATION } from './lot-trends.facade';

const period: AnalyticsPeriod = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };
const later: AnalyticsPeriod = { from: new Date('2026-11-01T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

function indicator(overrides: Partial<IndicatorValue> = {}): IndicatorValue {
  return { value: 12, unit: 'animals', formula: 'distinct animals with valid period readings', denominator: 14, unavailableReason: null, ...overrides };
}

function indicators(overrides: Partial<HerdIndicators> = {}): HerdIndicators {
  return {
    ranchId: 'ranch-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' }, updatedAt: '2026-11-12T00:00:00Z',
    source: 'ichu-platform', monitoredAnimals: indicator(), openAlertsByType: { temperature: 2 }, alertsUnavailableReason: null,
    outsideGeofenceAnimals: indicator({ value: 1, unit: 'animals' }), mortalityRate: indicator({ value: 0, unit: 'percent' }),
    births: indicator({ value: 3, unit: 'events', denominator: null }), confirmedPregnancies: indicator({ value: null, unit: 'events', denominator: null, unavailableReason: 'Pregnancy observations are unavailable.' }),
    excludedAnimals: 2, missingReadings: null, readingsCoverageReason: 'The expected reading count is unavailable.', ...overrides,
  };
}

function recentAlert(alertId: string, cattleId: string): RecentAlertSummary {
  return {
    alertId, cattleId, type: 'Temperature', severity: 'Critical', raisedAt: '2026-11-12T07:30:00.000Z',
    detectedValue: 40.1, unit: 'celsius', distanceToBoundaryMeters: null,
  };
}

function trendSeries(overrides: Partial<TrendSeries> = {}): TrendSeries {
  return {
    ranchId: 'ranch-1', lotId: 'lot-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' },
    updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform', metric: 'body-temperature', unit: 'celsius',
    lotAverage: 38.5, outlierDeviation: 1, points: [], outlierAnimals: [], missingReadings: null,
    coverageReason: null, unavailableReason: null, ...overrides,
  };
}

function reading(cattleId: string, value: number, recordedAt: Date): TrendPoint {
  return { cattleId, value, recordedAt: recordedAt.toISOString() };
}

describe('HerdDashboardFacade', () => {
  let facade: HerdDashboardFacade;
  let repository: { dashboard: ReturnType<typeof vi.fn> };
  let planning: { upcomingActivities: ReturnType<typeof vi.fn> };
  let cattle: { cattleSummaries: ReturnType<typeof vi.fn>; lotSummaries: ReturnType<typeof vi.fn> };
  let trends: { lotTrend: ReturnType<typeof vi.fn> };
  let monitoring: { recentAlerts: ReturnType<typeof vi.fn>; bodyTemperatureLimit: ReturnType<typeof vi.fn> };
  let iotAssets: { collarConnectivity: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { dashboard: vi.fn(async (): Promise<HerdIndicators> => indicators()) };
    planning = {
      upcomingActivities: vi.fn(async () => [
        { title: 'Vaccinate the herd', scheduledAt: '2026-11-13T08:00:00Z', cattleId: null },
        { title: 'Check the hoof', scheduledAt: '2026-11-14T09:00:00Z', cattleId: 'cattle-2' },
      ]),
    };
    cattle = {
      cattleSummaries: vi.fn(async () => [{ cattleId: 'cattle-2', earTag: '102', status: 'Active' }]),
      lotSummaries: vi.fn(async () => [{ lotId: 'lot-1', name: 'Heifers' }, { lotId: 'lot-2', name: 'Calves' }]),
    };
    trends = { lotTrend: vi.fn(async (): Promise<TrendSeries> => trendSeries()) };
    monitoring = { recentAlerts: vi.fn(async () => []), bodyTemperatureLimit: vi.fn(async () => null) };
    iotAssets = {
      collarConnectivity: vi.fn(async () => ({ communicating: 3, noCommunication: 1, neverReported: 0, lowBattery: 1 })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        HerdDashboardFacade,
        { provide: HerdIndicatorRepository, useValue: repository },
        { provide: LotTrendRepository, useValue: trends },
        { provide: PlanningContextFacade, useValue: planning },
        { provide: CattleInformationContextFacade, useValue: cattle },
        { provide: OperationsMonitoringContextFacade, useValue: monitoring },
        { provide: IotAssetsContextFacade, useValue: iotAssets },
      ],
    });
    facade = TestBed.inject(HerdDashboardFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the indicators of the period and the work of the next days, with ear tags instead of ids', async () => {
    await facade.open('ranch-1', period);

    expect(repository.dashboard).toHaveBeenCalledWith('ranch-1', period);
    expect(facade.report()?.monitoredAnimals.value).toBe(12);
    expect(planning.upcomingActivities).toHaveBeenCalledWith('ranch-1', UPCOMING_WORK_DAYS);
    expect(facade.upcoming()).toEqual([
      { title: 'Vaccinate the herd', scheduledAt: '2026-11-13T08:00:00Z', earTag: null },
      { title: 'Check the hoof', scheduledAt: '2026-11-14T09:00:00Z', earTag: '102' },
    ]);
  });

  it('reads the indicators again for a new period without reloading the upcoming work', async () => {
    await facade.open('ranch-1', period);
    await facade.setPeriod(later);

    expect(repository.dashboard).toHaveBeenLastCalledWith('ranch-1', later);
    expect(facade.period()).toBe(later);
    expect(planning.upcomingActivities).toHaveBeenCalledTimes(1);
  });

  it('keeps the upcoming work when the indicators fail, and reports the failure on its own', async () => {
    repository.dashboard.mockRejectedValueOnce(new ApiError(503, 'SourceUnavailable', 'Unavailable'));

    await facade.open('ranch-1', period);

    expect(facade.report()).toBeNull();
    expect(facade.error()?.title).toBe('Unavailable');
    expect(facade.upcoming()).toHaveLength(2);
    expect(facade.upcomingError()).toBeNull();
  });

  it('clears the view when no ranch is current', async () => {
    await facade.open(null, period);

    expect(repository.dashboard).not.toHaveBeenCalled();
    expect(facade.report()).toBeNull();
    expect(facade.upcoming()).toEqual([]);
    expect(monitoring.recentAlerts).not.toHaveBeenCalled();
    expect(trends.lotTrend).not.toHaveBeenCalled();
  });

  it('lists the newest open alerts with their ear tags, reading the animal list once for alerts and upcoming work', async () => {
    monitoring.recentAlerts.mockResolvedValue([recentAlert('alert-1', 'cattle-2'), recentAlert('alert-2', 'cattle-9')]);

    await facade.open('ranch-1', period);

    expect(monitoring.recentAlerts).toHaveBeenCalledWith('ranch-1', RECENT_ALERT_COUNT);
    expect(facade.alerts()).toEqual([
      {
        alertId: 'alert-1', type: 'Temperature', severity: 'Critical', raisedAt: '2026-11-12T07:30:00.000Z',
        detectedValue: 40.1, unit: 'celsius', distanceToBoundaryMeters: null, earTag: '102',
      },
      {
        alertId: 'alert-2', type: 'Temperature', severity: 'Critical', raisedAt: '2026-11-12T07:30:00.000Z',
        detectedValue: 40.1, unit: 'celsius', distanceToBoundaryMeters: null, earTag: null,
      },
    ]);
    expect(cattle.cattleSummaries).toHaveBeenCalledTimes(1);
  });

  it('skips the animal list when there is no alert and no upcoming work names an animal', async () => {
    planning.upcomingActivities.mockResolvedValue([{ title: 'Vaccinate the herd', scheduledAt: '2026-11-13T08:00:00Z', cattleId: null }]);

    await facade.open('ranch-1', period);

    expect(facade.alerts()).toEqual([]);
    expect(cattle.cattleSummaries).not.toHaveBeenCalled();
  });

  it('shows the collar connectivity of the ranch from the IoT assets context', async () => {
    await facade.open('ranch-1', period);

    expect(iotAssets.collarConnectivity).toHaveBeenCalledWith('ranch-1');
    expect(facade.collars()).toEqual({ communicating: 3, noCommunication: 1, neverReported: 0, lowBattery: 1 });
  });

  it('charts the daily body temperature of the first lot with its spread and the monitoring limit', async () => {
    trends.lotTrend.mockResolvedValue(trendSeries({
      points: [
        reading('cattle-2', 38, new Date(2026, 10, 10, 8)),
        reading('cattle-3', 40, new Date(2026, 10, 10, 8)),
        reading('cattle-2', 37.5, new Date(2026, 10, 11, 8)),
      ],
    }));
    monitoring.bodyTemperatureLimit.mockResolvedValue(39.5);

    await facade.open('ranch-1', period);

    expect(trends.lotTrend).toHaveBeenCalledWith('ranch-1', {
      lotId: 'lot-1', period, metric: 'body-temperature', deviation: SPREAD_PROBE_DEVIATION,
    });
    expect(facade.temperatureLots()).toEqual([{ lotId: 'lot-1', name: 'Heifers' }, { lotId: 'lot-2', name: 'Calves' }]);
    expect(facade.temperatureLotId()).toBe('lot-1');
    expect(facade.temperature()).toEqual([
      { day: '2026-11-10', mean: 39, spread: Math.SQRT2, animalCount: 2 },
      { day: '2026-11-11', mean: 37.5, spread: null, animalCount: 1 },
    ]);
    expect(facade.temperatureUnit()).toBe('celsius');
    expect(facade.temperatureLimit()).toBe(39.5);
    expect(facade.temperatureUnavailable()).toBeNull();
  });

  it('keeps the chosen lot while the ranch still has it, and falls back to the first lot once it is gone', async () => {
    await facade.open('ranch-1', period);

    await facade.selectTemperatureLot('lot-2');
    await facade.setPeriod(later);
    expect(facade.temperatureLotId()).toBe('lot-2');
    expect(trends.lotTrend).toHaveBeenLastCalledWith('ranch-1', expect.objectContaining({ lotId: 'lot-2', period: later }));

    cattle.lotSummaries.mockResolvedValueOnce([{ lotId: 'lot-1', name: 'Heifers' }]);
    await facade.setPeriod(period);
    expect(facade.temperatureLotId()).toBe('lot-1');
    expect(trends.lotTrend).toHaveBeenLastCalledWith('ranch-1', expect.objectContaining({ lotId: 'lot-1', period }));
  });

  it('leaves the temperature empty when the ranch has no lot, without reading any series', async () => {
    cattle.lotSummaries.mockResolvedValue([]);

    await facade.open('ranch-1', period);

    expect(facade.temperatureLotId()).toBeNull();
    expect(facade.temperature()).toEqual([]);
    expect(trends.lotTrend).not.toHaveBeenCalled();
    expect(monitoring.bodyTemperatureLimit).not.toHaveBeenCalled();
  });

  it('passes on the API reason for a temperature series it could not compute', async () => {
    trends.lotTrend.mockResolvedValue(trendSeries({ unavailableReason: 'Temperature readings are unavailable.' }));

    await facade.open('ranch-1', period);

    expect(facade.temperatureUnavailable()).toBe('Temperature readings are unavailable.');
    expect(facade.temperature()).toEqual([]);
  });

  it('keeps the other sections when the alerts fail', async () => {
    monitoring.recentAlerts.mockRejectedValueOnce(new ApiError(503, 'SourceUnavailable', 'Unavailable'));

    await facade.open('ranch-1', period);

    expect(facade.alerts()).toEqual([]);
    expect(facade.alertsError()?.title).toBe('Unavailable');
    expect(facade.report()?.monitoredAnimals.value).toBe(12);
    expect(facade.upcoming()).toHaveLength(2);
    expect(facade.collars()).toEqual({ communicating: 3, noCommunication: 1, neverReported: 0, lowBattery: 1 });
    expect(facade.temperatureError()).toBeNull();
  });

  it('keeps the other sections when the collars or the temperature fail', async () => {
    iotAssets.collarConnectivity.mockRejectedValueOnce(new ApiError(500, 'Unexpected', 'Collars unavailable'));
    trends.lotTrend.mockRejectedValueOnce(new ApiError(503, 'SourceUnavailable', 'Temperature unavailable'));

    await facade.open('ranch-1', period);

    expect(facade.collars()).toBeNull();
    expect(facade.collarsError()?.title).toBe('Collars unavailable');
    expect(facade.temperature()).toEqual([]);
    expect(facade.temperatureError()?.title).toBe('Temperature unavailable');
    expect(facade.temperatureLoading()).toBe(false);
    expect(facade.alertsError()).toBeNull();
    expect(facade.report()).not.toBeNull();
    expect(facade.upcoming()).toHaveLength(2);
  });
});
