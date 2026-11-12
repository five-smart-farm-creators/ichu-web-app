import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { ReproductiveHistory } from '../../domain/model/reproductive-history.model';
import { ReproductiveHistoryRepository } from '../../domain/repositories/reproductive-history.repository';
import { ReproductionFacade } from './reproduction.facade';

const animals: MonitoredCattleSummary[] = [
  { cattleId: 'male-1', earTag: '90', status: 'Active', lifeStage: 'FatteningBull', sex: 'Male' },
  { cattleId: 'cow-old', earTag: '10', status: 'Inactive', lifeStage: 'MilkingCow', sex: 'Female' },
  { cattleId: 'heifer-2', earTag: '20', status: 'Active', lifeStage: 'Heifer', sex: 'Female' },
  { cattleId: 'cow-1', earTag: '9', status: 'Active', lifeStage: 'MilkingCow', sex: 'Female' },
];

function history(cattleId: string, overrides: Partial<ReproductiveHistory> = {}): ReproductiveHistory {
  return {
    cattleId, sex: 'Female', lifeStage: 'MilkingCow', ageInMonths: 48, hasHistory: false,
    services: [], pregnancyDiagnoses: [], calvings: [], abortions: [], heatsObserved: [], intervals: [],
    servicesPerPregnancy: null, pregnanciesConfirmed: 0, ...overrides,
  };
}

describe('ReproductionFacade', () => {
  let facade: ReproductionFacade;
  let histories: { get: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Local time keeps the open days the same on any machine.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    histories = { get: vi.fn(async (_ranchId: string, cattleId: string) => history(cattleId)) };
    cattleContext = { monitoredCattle: vi.fn(async () => animals) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ReproductionFacade,
        { provide: ReproductiveHistoryRepository, useValue: histories },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(ReproductionFacade);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('lists the females only, active ones first, each group by ear tag', async () => {
    await facade.open('ranch-1', null);

    expect(facade.females().map(animal => animal.earTag)).toEqual(['9', '20', '10']);
  });

  it('loads the history of the chosen female and derives her open days from the last calving', async () => {
    histories.get.mockResolvedValueOnce(history('cow-1', {
      hasHistory: true, calvings: [{ occurredAt: new Date(2026, 9, 1, 8).toISOString() }],
      intervals: [{ calvingAt: new Date(2026, 9, 1, 8).toISOString(), conceptionServiceAt: null, daysOpen: null }],
    }));

    await facade.open('ranch-1', 'cow-1');

    expect(histories.get).toHaveBeenCalledWith('ranch-1', 'cow-1');
    expect(facade.animal()?.earTag).toBe('9');
    expect(facade.daysOpen()).toBe(42);
    expect(facade.lastCalving()?.occurredAt).toBe(new Date(2026, 9, 1, 8).toISOString());
  });

  it('does not ask for the history of a male or of an animal outside the ranch', async () => {
    await facade.open('ranch-1', 'male-1');
    await facade.selectAnimal('cattle-unknown');

    expect(facade.animal()).toBeNull();
    expect(histories.get).not.toHaveBeenCalled();
  });

  it('clears the history and keeps the failure when a reload fails', async () => {
    await facade.open('ranch-1', 'cow-1');
    histories.get.mockRejectedValueOnce(new ApiError(0, 'network', null));

    await facade.refresh();

    expect(facade.history()).toBeNull();
    expect(facade.error()).toMatchObject({ code: 'network' });
  });
});
