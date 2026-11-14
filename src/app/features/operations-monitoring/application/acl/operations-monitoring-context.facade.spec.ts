import { TestBed } from '@angular/core/testing';
import type { Alert } from '../../domain/model/alert.model';
import { isClinicalType, type LivestockOperation } from '../../domain/model/livestock-operation.model';
import type { MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
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

describe('OperationsMonitoringContextFacade', () => {
  let facade: OperationsMonitoringContextFacade;
  let operations: { list: ReturnType<typeof vi.fn> };
  let alerts: { list: ReturnType<typeof vi.fn> };
  let thresholds: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    operations = {
      list: vi.fn(async () => [operation('vaccination-1', 'Vaccination'), operation('birth-1', 'Birth'), operation('treatment-1', 'Treatment')]),
    };
    alerts = { list: vi.fn(async () => ({ page: 1, pageSize: 3, totalCount: 0, items: [] as Alert[] })) };
    thresholds = { list: vi.fn(async () => [] as MonitoringThreshold[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        OperationsMonitoringContextFacade,
        { provide: LivestockOperationRepository, useValue: operations },
        { provide: AlertRepository, useValue: alerts },
        { provide: MonitoringThresholdRepository, useValue: thresholds },
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
});
