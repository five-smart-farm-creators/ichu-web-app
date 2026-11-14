import { TestBed } from '@angular/core/testing';
import type { Alert } from '../../domain/model/alert.model';
import { isClinicalType, type LivestockOperation } from '../../domain/model/livestock-operation.model';
import type { MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import type { WaterReading, WaterReadingPeriod, WaterTroughStatus } from '../../domain/model/water-status.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { WaterStatusRepository } from '../../domain/repositories/water-status.repository';
import { OperationsMonitoringContextFacade } from './operations-monitoring-context.facade';

function operation(id: string, type: LivestockOperation['type']): LivestockOperation {
  const clinical = isClinicalType(type);
  return {
    operationId: id, cattleId: 'cattle-1', type, isClinical: clinical, occurredAt: '2026-11-10T10:00:00.000Z',
    receivedAt: '2026-11-10T10:00:00.000Z', observation: 'Note', product: clinical ? 'Vaccine' : null, dose: null,
    sireReference: null, pregnancyResult: null, expectedCalvingDate: null,
  };
}

function alert(id: string): Alert {
  return {
    alertId: id, cattleId: 'cattle-1', type: 'Temperature', severity: 'Critical', status: 'Pending',
    raisedAt: '2026-11-12T07:30:00.000Z', detectedValue: 40.1, unit: 'celsius', thresholdMinValue: null,
    thresholdMaxValue: 39.5, geofenceId: null, latitude: null, longitude: null, distanceToBoundaryMeters: null,
    exitDurationSeconds: null, acknowledgedAt: null, finding: 'Fever', action: 'Isolate', responseTimeSeconds: null,
    version: 2,
  };
}

function threshold(lifeStage: string, metric: MonitoringThreshold['metric'], maxValue: number): MonitoringThreshold {
  return { thresholdId: `${lifeStage}-${metric}`, lifeStage, metric, minValue: 37, maxValue, severity: 'Warning', revision: 1 };
}

function waterReading(overrides: Partial<WaterReading> = {}): WaterReading {
  return {
    id: 'row-1', readingId: 'reading-1', controllerId: 'controller-1', waterTroughId: 'trough-1', ranchId: 'ranch-1',
    gatewayId: 'gateway-1', temperature: 18.4, temperatureUnit: 'Celsius', isValid: true, heaterState: 'Off',
    capturedAt: '2026-11-14T10:00:00.000000Z', receivedAt: '2026-11-14T10:00:02.000000Z', origin: 'EdgeGateway',
    ...overrides,
  };
}

function waterStatus(overrides: Partial<WaterTroughStatus> = {}): WaterTroughStatus {
  return {
    waterTroughId: 'trough-1', name: 'North trough', lotId: 'lot-1', minimumCelsius: 12, maximumCelsius: 24,
    controllerStatus: 'Communicating', controllerId: 'controller-1', controllerAssignedAt: '2026-11-01T00:00:00.000000Z',
    lastCommunicationAt: '2026-11-14T10:00:02.000000Z', measurementStatus: 'Valid', rangeStatus: 'WithinRange',
    latestReading: waterReading(), evaluatedAt: '2026-11-14T10:05:00.000000Z', ...overrides,
  };
}

describe('OperationsMonitoringContextFacade', () => {
  let facade: OperationsMonitoringContextFacade;
  let operations: { list: ReturnType<typeof vi.fn> };
  let alerts: { list: ReturnType<typeof vi.fn> };
  let thresholds: { list: ReturnType<typeof vi.fn> };
  let water: { troughStatuses: ReturnType<typeof vi.fn>; readings: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    operations = {
      list: vi.fn(async () => [operation('vaccination-1', 'Vaccination'), operation('birth-1', 'Birth'), operation('treatment-1', 'Treatment')]),
    };
    alerts = { list: vi.fn(async () => ({ page: 1, pageSize: 3, totalCount: 0, items: [] as Alert[] })) };
    thresholds = { list: vi.fn(async () => [] as MonitoringThreshold[]) };
    water = { troughStatuses: vi.fn(async () => [] as WaterTroughStatus[]), readings: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        OperationsMonitoringContextFacade,
        { provide: LivestockOperationRepository, useValue: operations },
        { provide: AlertRepository, useValue: alerts },
        { provide: MonitoringThresholdRepository, useValue: thresholds },
        { provide: WaterStatusRepository, useValue: water },
      ],
    });
    facade = TestBed.inject(OperationsMonitoringContextFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('publishes only the clinical interventions, without the product, the author or the notes', async () => {
    expect(await facade.interventionsFor('ranch-1', 'cattle-1')).toEqual([
      { interventionId: 'vaccination-1', cattleId: 'cattle-1', type: 'Vaccination', occurredAt: '2026-11-10T10:00:00.000Z' },
      { interventionId: 'treatment-1', cattleId: 'cattle-1', type: 'Treatment', occurredAt: '2026-11-10T10:00:00.000Z' },
    ]);
  });

  it('reads from the earliest record up to tomorrow', async () => {
    await facade.interventionsFor('ranch-1', 'cattle-1');

    const period = operations.list.mock.calls[0][2] as { from: Date; to: Date };
    expect(period.from).toEqual(new Date('2000-01-01T00:00:00Z'));
    expect(period.to.getTime()).toBeGreaterThan(Date.now());
  });

  it('publishes the pending alerts without their acknowledgement, one page up to the limit', async () => {
    alerts.list.mockResolvedValue({ page: 1, pageSize: 3, totalCount: 1, items: [alert('alert-1')] });

    expect(await facade.recentAlerts('ranch-1', 3)).toEqual([{
      alertId: 'alert-1', cattleId: 'cattle-1', type: 'Temperature', severity: 'Critical',
      raisedAt: '2026-11-12T07:30:00.000Z', detectedValue: 40.1, unit: 'celsius', distanceToBoundaryMeters: null,
    }]);
    expect(alerts.list).toHaveBeenCalledWith('ranch-1', { status: 'Pending', cattleId: null }, 1, 3);
  });

  it('takes the lowest body temperature maximum, so a lot that mixes stages keeps every alert visible', async () => {
    thresholds.list.mockResolvedValue([
      threshold('Calf', 'BodyTemperature', 40.2),
      threshold('MilkingCow', 'BodyTemperature', 39.5),
      threshold('Heifer', 'ActivityIndex', 30),
    ]);

    expect(await facade.bodyTemperatureLimit('ranch-1')).toBe(39.5);
    expect(thresholds.list).toHaveBeenCalledWith('ranch-1');
  });

  it('returns no body temperature limit when the ranch has none configured', async () => {
    thresholds.list.mockResolvedValue([threshold('Calf', 'ActivityIndex', 30)]);

    expect(await facade.bodyTemperatureLimit('ranch-1')).toBeNull();
  });

  it('publishes each water trough status with its latest reading, without the name, the band or the assignment dates', async () => {
    water.troughStatuses.mockResolvedValue([
      waterStatus(),
      waterStatus({
        waterTroughId: 'trough-2', controllerId: null, controllerStatus: 'NoController', lastCommunicationAt: null,
        measurementStatus: 'Invalid', rangeStatus: 'Unavailable',
        latestReading: waterReading({ isValid: false, temperature: 0, heaterState: 'On' }),
      }),
    ]);

    expect(await facade.waterTroughStatuses('ranch-1')).toEqual([
      {
        waterTroughId: 'trough-1', controllerId: 'controller-1', controllerStatus: 'Communicating',
        lastCommunicationAt: '2026-11-14T10:00:02.000000Z', measurementStatus: 'Valid', rangeStatus: 'WithinRange',
        latestReading: { capturedAt: '2026-11-14T10:00:00.000000Z', temperature: 18.4, isValid: true, heaterState: 'Off' },
      },
      {
        waterTroughId: 'trough-2', controllerId: null, controllerStatus: 'NoController', lastCommunicationAt: null,
        measurementStatus: 'Invalid', rangeStatus: 'Unavailable',
        latestReading: { capturedAt: '2026-11-14T10:00:00.000000Z', temperature: null, isValid: false, heaterState: 'On' },
      },
    ]);
    expect(water.troughStatuses).toHaveBeenCalledWith('ranch-1');
  });

  it('reads the first page of a period at the API maximum and publishes an invalid temperature as null', async () => {
    const period: WaterReadingPeriod = { from: new Date('2026-11-13T00:00:00.000Z'), to: new Date('2026-11-14T00:00:00.000Z') };
    water.readings.mockResolvedValue({
      controllerId: 'controller-1', from: '2026-11-13T00:00:00.000000Z', to: '2026-11-14T00:00:00.000000Z',
      page: 1, pageSize: 500, totalCount: 2,
      items: [
        waterReading({ temperature: 19.2 }),
        waterReading({ readingId: 'reading-2', capturedAt: '2026-11-13T12:05:00.000000Z', isValid: false, temperature: 0, heaterState: 'On' }),
      ],
    });

    expect(await facade.waterReadings('controller-1', period)).toEqual({
      totalCount: 2,
      items: [
        { capturedAt: '2026-11-14T10:00:00.000000Z', temperature: 19.2, isValid: true, heaterState: 'Off' },
        { capturedAt: '2026-11-13T12:05:00.000000Z', temperature: null, isValid: false, heaterState: 'On' },
      ],
    });
    expect(water.readings).toHaveBeenCalledWith('controller-1', period, 1, 500);
  });
});
