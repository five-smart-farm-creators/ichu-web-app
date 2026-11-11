import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { Cattle } from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { LotsFacade } from './lots.facade';

const RANCH = 'ranch-1';

function cattle(id: string, earTag: string, status: Cattle['status'] = 'Active'): Cattle {
  return {
    id, ranchId: RANCH, earTag, breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10', currentStage: 'Calf',
    status, exitReason: status === 'Inactive' ? 'Sale' : null, exitDate: status === 'Inactive' ? '2026-10-01' : null,
    version: 'animal-version', stagePeriods: [],
  };
}

function lot(id: string, name: string, memberIds: string[], version = 'lot-v1'): Lot {
  return {
    id, ranchId: RANCH, name, criterion: null, version,
    memberships: memberIds.map(cattleId => ({ cattleId, assignedAt: '2026-01-05T08:00:00Z' })),
  };
}

const directory = [
  cattle('cattle-1', '101'),
  cattle('cattle-2', '102', 'Inactive'),
  cattle('cattle-3', '103'),
];

describe('LotsFacade', () => {
  let facade: LotsFacade;
  let cattleRepository: { list: ReturnType<typeof vi.fn> };
  let lotRepository: Record<'list' | 'create' | 'assignCattle' | 'removeCattle', ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    cattleRepository = { list: vi.fn(async () => directory) };
    lotRepository = {
      list: vi.fn(async () => [lot('lot-1', 'Calves', ['cattle-1'])]),
      create: vi.fn(),
      assignCattle: vi.fn(),
      removeCattle: vi.fn(),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LotsFacade,
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: lotRepository },
      ],
    });
    facade = TestBed.inject(LotsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens the ranch with its lots and every animal, active and inactive', async () => {
    await facade.open(RANCH);
    facade.selectLot('lot-1');

    expect(facade.lots()).toHaveLength(1);
    expect(facade.directory()).toHaveLength(3);
    expect(facade.members()).toEqual([
      { cattleId: 'cattle-1', earTag: '101', status: 'Active', assignedAt: '2026-01-05T08:00:00Z' },
    ]);
  });

  it('offers only active animals that are not yet in the selected lot', async () => {
    await facade.open(RANCH);
    facade.selectLot('lot-1');

    expect(facade.assignable().map(animal => animal.id)).toEqual(['cattle-3']);
  });

  it('adds an animal under the lot version and keeps the lot the API returned', async () => {
    await facade.open(RANCH);
    facade.selectLot('lot-1');
    lotRepository.assignCattle.mockResolvedValue(lot('lot-1', 'Calves', ['cattle-1', 'cattle-3'], 'lot-v2'));

    await facade.addAnimal('cattle-3');

    expect(lotRepository.assignCattle).toHaveBeenCalledWith(RANCH, 'lot-1', 'cattle-3', 'lot-v1');
    expect(facade.selectedLot()?.version).toBe('lot-v2');
    expect(facade.members()).toHaveLength(2);
  });

  it('removes an animal under the lot version and keeps its own record', async () => {
    await facade.open(RANCH);
    facade.selectLot('lot-1');
    lotRepository.removeCattle.mockResolvedValue(lot('lot-1', 'Calves', [], 'lot-v2'));

    await facade.removeAnimal('cattle-1');

    expect(lotRepository.removeCattle).toHaveBeenCalledWith(RANCH, 'lot-1', 'cattle-1', 'lot-v1');
    expect(facade.members()).toEqual([]);
    expect(facade.directory()).toHaveLength(3);
  });

  it('reloads lots and animals after a version conflict and rejects with the conflict code', async () => {
    await facade.open(RANCH);
    facade.selectLot('lot-1');
    lotRepository.assignCattle.mockRejectedValue(new ApiError(409, 'version-conflict', null));

    await expect(facade.addAnimal('cattle-3')).rejects.toMatchObject({ code: 'version-conflict' });

    expect(lotRepository.list).toHaveBeenCalledTimes(2);
    expect(cattleRepository.list).toHaveBeenCalledTimes(2);
    expect(facade.selectedLotId()).toBe('lot-1');
  });

  it('creates a lot and lists it by name', async () => {
    lotRepository.create.mockResolvedValue(lot('lot-2', 'Alpha', []));
    await facade.open(RANCH);

    await facade.create({ name: 'Alpha' });

    expect(lotRepository.create).toHaveBeenCalledWith(RANCH, { name: 'Alpha' });
    expect(facade.lots().map(item => item.name)).toEqual(['Alpha', 'Calves']);
  });
});
