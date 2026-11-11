import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { CattleProfile } from '../../domain/model/cattle-profile.model';
import type { Cattle } from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { CattleProfileFacade } from './cattle-profile.facade';

const RANCH = 'ranch-1';

function cattle(overrides: Partial<Cattle> = {}): Cattle {
  return {
    id: 'cattle-1', ranchId: RANCH, earTag: '101', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10',
    currentStage: 'Calf', status: 'Active', exitReason: null, exitDate: null, version: 'version-1',
    stagePeriods: [{ id: 'period-1', lifeStage: 'Calf', validFrom: '2025-01-10', validTo: null }],
    ...overrides,
  };
}

function profile(animal: Cattle): CattleProfile {
  return { cattle: animal, device: { isAvailable: true, collarId: null, lastReadingReceivedAt: null } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe('CattleProfileFacade', () => {
  let facade: CattleProfileFacade;
  let cattleRepository: Record<'profile' | 'update' | 'changeLifeStage' | 'recordExit', ReturnType<typeof vi.fn>>;
  let lotRepository: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cattleRepository = {
      profile: vi.fn(async () => profile(cattle())),
      update: vi.fn(),
      changeLifeStage: vi.fn(),
      recordExit: vi.fn(),
    };
    lotRepository = { list: vi.fn(async () => [] as Lot[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CattleProfileFacade,
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: lotRepository },
      ],
    });
    facade = TestBed.inject(CattleProfileFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the animal with its collar status and the names of its lots', async () => {
    lotRepository.list.mockResolvedValue([
      { id: 'lot-1', ranchId: RANCH, name: 'Calves', criterion: null, version: 'lot-v1', memberships: [{ cattleId: 'cattle-1', assignedAt: '2026-01-01T00:00:00Z' }] },
    ]);

    await facade.load(RANCH, 'cattle-1');

    expect(facade.animal()?.earTag).toBe('101');
    expect(facade.device()?.isAvailable).toBe(true);
    expect(facade.lotNames()).toBe('Calves');
  });

  it('saves identification changes with the version that was loaded', async () => {
    await facade.load(RANCH, 'cattle-1');
    cattleRepository.update.mockResolvedValue(cattle({ earTag: '202', version: 'version-2' }));

    await facade.update({ earTag: '202', breed: 'Fleckvieh', sex: 'Male', birthDate: '2025-01-10' });

    expect(cattleRepository.update).toHaveBeenCalledWith(RANCH, 'cattle-1', {
      earTag: '202', breed: 'Fleckvieh', sex: 'Male', birthDate: '2025-01-10', expectedVersion: 'version-1',
    });
    expect(facade.animal()?.earTag).toBe('202');
    expect(facade.animal()?.version).toBe('version-2');
  });

  it('replaces the animal with the returned stage history after a stage change', async () => {
    await facade.load(RANCH, 'cattle-1');
    cattleRepository.changeLifeStage.mockResolvedValue(cattle({
      currentStage: 'Heifer',
      version: 'version-2',
      stagePeriods: [
        { id: 'period-1', lifeStage: 'Calf', validFrom: '2025-01-10', validTo: '2026-06-01' },
        { id: 'period-2', lifeStage: 'Heifer', validFrom: '2026-06-01', validTo: null },
      ],
    }));

    await facade.changeLifeStage({ lifeStage: 'Heifer', validFrom: '2026-06-01' });

    expect(cattleRepository.changeLifeStage).toHaveBeenCalledWith(RANCH, 'cattle-1', {
      lifeStage: 'Heifer', validFrom: '2026-06-01', expectedVersion: 'version-1',
    });
    expect(facade.animal()?.currentStage).toBe('Heifer');
    expect(facade.animal()?.stagePeriods).toHaveLength(2);
  });

  it('makes an exited animal read-only through the returned record', async () => {
    await facade.load(RANCH, 'cattle-1');
    cattleRepository.recordExit.mockResolvedValue(cattle({
      status: 'Inactive', exitReason: 'Sale', exitDate: '2026-11-01', version: 'version-2',
    }));

    await facade.recordExit({ reason: 'Sale', exitDate: '2026-11-01' });

    expect(cattleRepository.recordExit).toHaveBeenCalledWith(RANCH, 'cattle-1', {
      reason: 'Sale', exitDate: '2026-11-01', expectedVersion: 'version-1',
    });
    expect(facade.animal()?.status).toBe('Inactive');
    expect(facade.animal()?.exitReason).toBe('Sale');
  });

  it('reloads the animal after a version conflict and rejects with the conflict code', async () => {
    await facade.load(RANCH, 'cattle-1');
    cattleRepository.update.mockRejectedValue(new ApiError(409, 'version-conflict', null));
    cattleRepository.profile.mockResolvedValue(profile(cattle({ version: 'version-2', earTag: '999' })));

    await expect(facade.update({ earTag: '202', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10' }))
      .rejects.toMatchObject({ status: 409, code: 'version-conflict' });

    expect(cattleRepository.profile).toHaveBeenCalledTimes(2);
    expect(facade.animal()?.version).toBe('version-2');
    expect(facade.animal()?.earTag).toBe('999');
  });

  it('ignores a response for an animal that is no longer shown', async () => {
    const stale = deferred<CattleProfile>();
    cattleRepository.profile
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(profile(cattle({ id: 'cattle-2', earTag: '202' })));

    const first = facade.load(RANCH, 'cattle-1');
    await facade.load(RANCH, 'cattle-2');
    stale.resolve(profile(cattle({ id: 'cattle-1' })));
    await first;

    expect(facade.animal()?.id).toBe('cattle-2');
  });
});
