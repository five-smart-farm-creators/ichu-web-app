import { TestBed } from '@angular/core/testing';
import type { MonitoredCattleSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { LatestIndicator, LatestTelemetry } from '../../domain/model/telemetry.model';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { HERD_LATEST_LIMIT, HerdMonitoringFacade } from './herd-monitoring.facade';

const unavailable: LatestIndicator = { status: 'Unavailable', value: null, unit: 'celsius', recordedAt: null, isStale: null };

function animal(id: string): MonitoredCattleSummary {
  return { cattleId: id, earTag: 'tag-' + id, status: 'Active', lifeStage: 'Calf' };
}

function latest(cattleId: string): LatestTelemetry {
  return {
    cattleId,
    evaluatedAt: '2026-11-11T12:00:00Z',
    lastReadingRecordedAt: null,
    bodyTemperature: unavailable,
    activityIndex: { ...unavailable, unit: 'index' },
    ruminationMinutes: { ...unavailable, unit: 'minutes' },
    lastKnownPosition: { status: 'Unavailable', latitude: null, longitude: null, accuracyMeters: null, recordedAt: null, isStale: null },
  };
}

describe('HerdMonitoringFacade', () => {
  let facade: HerdMonitoringFacade;
  let telemetry: { latest: ReturnType<typeof vi.fn> };
  let cattleContext: { lotSummaries: ReturnType<typeof vi.fn>; monitoredCattle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    telemetry = { latest: vi.fn(async (_ranchId: string, cattleId: string) => latest(cattleId)) };
    cattleContext = {
      lotSummaries: vi.fn(async () => [{ lotId: 'lot-1', name: 'Heifers' }]),
      monitoredCattle: vi.fn(async () => [animal('cattle-1'), animal('cattle-2')]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        HerdMonitoringFacade,
        { provide: TelemetryRepository, useValue: telemetry },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(HerdMonitoringFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the latest values of every active animal of the ranch', async () => {
    await facade.open('ranch-1');

    expect(cattleContext.monitoredCattle).toHaveBeenCalledWith('ranch-1', { activeOnly: true, lotId: null }, HERD_LATEST_LIMIT + 1);
    expect(telemetry.latest).toHaveBeenCalledWith('ranch-1', 'cattle-1');
    expect(facade.rows().map(row => row.animal.cattleId)).toEqual(['cattle-1', 'cattle-2']);
    expect(facade.rows()[0].failed).toBe(false);
    expect(facade.lots()).toEqual([{ lotId: 'lot-1', name: 'Heifers' }]);
  });

  it('narrows the herd to one lot before reading values', async () => {
    await facade.open('ranch-1');
    await facade.selectLot('lot-1');

    expect(cattleContext.monitoredCattle).toHaveBeenLastCalledWith('ranch-1', { activeOnly: true, lotId: 'lot-1' }, HERD_LATEST_LIMIT + 1);
  });

  it('asks for a lot filter instead of reading values for a herd above the limit', async () => {
    cattleContext.monitoredCattle.mockResolvedValue(Array.from({ length: HERD_LATEST_LIMIT + 1 }, (_, index) => animal(`cattle-${index}`)));

    await facade.open('ranch-1');

    expect(facade.tooManyAnimals()).toBe(true);
    expect(facade.rows()).toEqual([]);
    expect(telemetry.latest).not.toHaveBeenCalled();
  });

  it('keeps an unreadable animal as a failed row instead of an animal without readings', async () => {
    telemetry.latest.mockImplementation(async (_ranchId: string, cattleId: string) => {
      if (cattleId === 'cattle-2') throw new Error('unreachable');
      return latest(cattleId);
    });

    await facade.open('ranch-1');

    expect(facade.rows()[1]).toMatchObject({ failed: true, latest: null });
    expect(facade.rows()[0].failed).toBe(false);
  });

  it('never has more than four latest-value requests in flight', async () => {
    cattleContext.monitoredCattle.mockResolvedValue(Array.from({ length: 12 }, (_, index) => animal(`cattle-${index}`)));
    let active = 0;
    let peak = 0;
    telemetry.latest.mockImplementation(async (_ranchId: string, cattleId: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return latest(cattleId);
    });

    await facade.open('ranch-1');

    expect(facade.rows()).toHaveLength(12);
    expect(peak).toBe(4);
  });
});
