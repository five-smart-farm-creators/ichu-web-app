import { TestBed } from '@angular/core/testing';
import type { Cattle } from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { CattleInformationContextFacade } from './cattle-information-context.facade';

function cattle(id: string, status: Cattle['status']): Cattle {
  return {
    id, ranchId: 'ranch-1', earTag: 'tag-' + id, breed: 'Criollo', sex: 'Male', birthDate: '2025-01-10',
    currentStage: 'Calf', status, exitReason: null, exitDate: null, version: 'v1', stagePeriods: [],
  };
}

describe('CattleInformationContextFacade', () => {
  let facade: CattleInformationContextFacade;
  let cattleRepository: { list: ReturnType<typeof vi.fn> };
  let lotRepository: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cattleRepository = { list: vi.fn() };
    lotRepository = { list: vi.fn(async () => [] as Lot[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CattleInformationContextFacade,
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: lotRepository },
      ],
    });
    facade = TestBed.inject(CattleInformationContextFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('publishes only identity, ear tag and status, including inactive animals', async () => {
    cattleRepository.list.mockResolvedValue([cattle('cattle-1', 'Active'), cattle('cattle-2', 'Inactive')]);

    expect(await facade.cattleSummaries('ranch-1')).toEqual([
      { cattleId: 'cattle-1', earTag: 'tag-cattle-1', status: 'Active' },
      { cattleId: 'cattle-2', earTag: 'tag-cattle-2', status: 'Inactive' },
    ]);
  });

  it('reads past the first page of the ranch', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => cattle(`cattle-${index}`, 'Active'));
    cattleRepository.list
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([cattle('cattle-100', 'Active')]);

    const summaries = await facade.cattleSummaries('ranch-1');

    expect(summaries).toHaveLength(101);
    expect(cattleRepository.list).toHaveBeenNthCalledWith(2, 'ranch-1', {}, 2, 100);
  });

  it('publishes only the identity and name of each lot', async () => {
    const lot: Lot = {
      id: 'lot-1', ranchId: 'ranch-1', name: 'Heifers', criterion: 'Age', version: 'v1',
      memberships: [{ cattleId: 'cattle-1', assignedAt: '2026-01-01T00:00:00Z' }],
    };
    lotRepository.list.mockResolvedValue([lot]);

    expect(await facade.lotSummaries('ranch-1')).toEqual([{ lotId: 'lot-1', name: 'Heifers' }]);
    expect(lotRepository.list).toHaveBeenCalledWith('ranch-1');
  });
});
