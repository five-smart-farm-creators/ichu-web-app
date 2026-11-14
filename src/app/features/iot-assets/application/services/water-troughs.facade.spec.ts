import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade, type LotSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  OperationsMonitoringContextFacade, type WaterTroughStatusSummary,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import type { WaterTrough } from '../../domain/model/water-trough.model';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';
import { WaterTroughsFacade } from './water-troughs.facade';

const RANCH = 'ranch-1';
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function trough(id: string, name: string, overrides: Partial<WaterTrough> = {}): WaterTrough {
  return { id, ranchId: RANCH, name, lotId: null, temperatureRange: null, version: 'version-' + id, ...overrides };
}

function statusSummary(waterTroughId: string): WaterTroughStatusSummary {
  return {
    waterTroughId, controllerId: 'controller-1', controllerStatus: 'Communicating',
    lastCommunicationAt: '2026-11-14T10:00:02.000000Z', measurementStatus: 'Valid', rangeStatus: 'WithinRange',
    latestReading: { capturedAt: '2026-11-14T10:00:00.000000Z', temperature: 18.4, isValid: true, heaterState: 'Off' },
  };
}

describe('WaterTroughsFacade', () => {
  let facade: WaterTroughsFacade;
  let troughRepository: {
    list: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    configureTemperatureRange: ReturnType<typeof vi.fn>;
  };
  let cattleContext: { lotSummaries: ReturnType<typeof vi.fn> };
  let monitoring: { waterTroughStatuses: ReturnType<typeof vi.fn>; waterReadings: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    troughRepository = {
      list: vi.fn(async () => [] as WaterTrough[]),
      register: vi.fn(),
      configureTemperatureRange: vi.fn(),
    };
    cattleContext = { lotSummaries: vi.fn(async () => [] as LotSummary[]) };
    monitoring = { waterTroughStatuses: vi.fn(async () => [] as WaterTroughStatusSummary[]), waterReadings: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        WaterTroughsFacade,
        { provide: WaterTroughRepository, useValue: troughRepository },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
        { provide: OperationsMonitoringContextFacade, useValue: monitoring },
      ],
    });
    facade = TestBed.inject(WaterTroughsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the troughs and the names of their lots', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North', { lotId: 'lot-1' }), trough('trough-2', 'South')]);
    cattleContext.lotSummaries.mockResolvedValue([{ lotId: 'lot-1', name: 'Heifers' }]);

    await facade.open(RANCH);

    expect(facade.lotName('lot-1')).toBe('Heifers');
    expect(facade.lotName('lot-missing')).toBeNull();
    expect(facade.lotName(null)).toBeNull();
    expect(cattleContext.lotSummaries).toHaveBeenCalledWith(RANCH);
  });

  it('registers a trough with the chosen lot and lists it by name', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-2', 'South')]);
    await facade.open(RANCH);
    troughRepository.register.mockResolvedValue(trough('trough-1', 'North', { lotId: 'lot-1' }));

    await facade.register({ name: 'North', lotId: 'lot-1' });

    expect(troughRepository.register).toHaveBeenCalledWith(RANCH, { name: 'North', lotId: 'lot-1' });
    expect(facade.troughs().map(item => item.name)).toEqual(['North', 'South']);
  });

  it('saves a temperature band with the loaded version and replaces the trough', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North')]);
    await facade.open(RANCH);
    troughRepository.configureTemperatureRange.mockResolvedValue(trough('trough-1', 'North', {
      temperatureRange: { minimumCelsius: 12, maximumCelsius: 24 }, version: 'version-2',
    }));

    await facade.configureTemperatureRange('trough-1', { minimumCelsius: 12, maximumCelsius: 24 });

    expect(troughRepository.configureTemperatureRange).toHaveBeenCalledWith(RANCH, 'trough-1', {
      minimumCelsius: 12, maximumCelsius: 24, expectedVersion: 'version-trough-1',
    });
    expect(facade.troughs()[0].temperatureRange).toEqual({ minimumCelsius: 12, maximumCelsius: 24 });
  });

  it('reloads the troughs after a version conflict and passes the conflict to the caller', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North')]);
    await facade.open(RANCH);
    troughRepository.configureTemperatureRange.mockRejectedValue(new ApiError(409, VERSION_CONFLICT, null));

    await expect(
      facade.configureTemperatureRange('trough-1', { minimumCelsius: 12, maximumCelsius: 24 }),
    ).rejects.toMatchObject({ code: VERSION_CONFLICT });
    expect(troughRepository.list).toHaveBeenCalledTimes(2);
  });

  it('matches each trough with its controller status by identifier', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North'), trough('trough-2', 'South')]);
    monitoring.waterTroughStatuses.mockResolvedValue([statusSummary('trough-1')]);

    await facade.open(RANCH);

    expect(monitoring.waterTroughStatuses).toHaveBeenCalledWith(RANCH);
    expect(facade.statusOf('trough-1')).toEqual(statusSummary('trough-1'));
    expect(facade.statusOf('trough-2')).toBeNull();
    expect(facade.statusError()).toBeNull();
  });

  it('keeps the troughs listed when the status read fails and reports only the status failure', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North')]);
    monitoring.waterTroughStatuses.mockRejectedValue(new ApiError(500, 'http-500', null));

    await facade.open(RANCH);

    expect(facade.troughs().map(item => item.name)).toEqual(['North']);
    expect(facade.statusOf('trough-1')).toBeNull();
    expect(facade.statusError()).toMatchObject({ code: 'http-500' });
    expect(facade.error()).toBeNull();
  });

  it('reads the statuses again after a temperature band is saved', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North')]);
    await facade.open(RANCH);
    troughRepository.configureTemperatureRange.mockResolvedValue(trough('trough-1', 'North', {
      temperatureRange: { minimumCelsius: 12, maximumCelsius: 24 }, version: 'version-2',
    }));

    await facade.configureTemperatureRange('trough-1', { minimumCelsius: 12, maximumCelsius: 24 });

    expect(monitoring.waterTroughStatuses).toHaveBeenCalledTimes(2);
  });

  it('reads the statuses again after a trough is registered', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-2', 'South')]);
    await facade.open(RANCH);
    troughRepository.register.mockResolvedValue(trough('trough-1', 'North'));

    await facade.register({ name: 'North' });

    expect(monitoring.waterTroughStatuses).toHaveBeenCalledTimes(2);
  });

  it('reads the last 24 hours of readings of the controller', async () => {
    monitoring.waterReadings.mockResolvedValue({ totalCount: 0, items: [] });

    await facade.readingsOf('controller-1');

    const [controllerId, period] = monitoring.waterReadings.mock.calls[0] as [string, { from: Date; to: Date }];
    expect(controllerId).toBe('controller-1');
    expect(period.to.getTime() - period.from.getTime()).toBe(DAY_MILLISECONDS);
  });
});
