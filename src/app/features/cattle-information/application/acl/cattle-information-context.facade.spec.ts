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
  let cattleRepository: { list: ReturnType<typeof vi.fn>; profile: ReturnType<typeof vi.fn> };
  let lotRepository: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cattleRepository = { list: vi.fn(), profile: vi.fn() };
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

  it('lists active animals of one lot with their productive stage, reading no more than the limit', async () => {
    cattleRepository.list.mockResolvedValue([cattle('cattle-1', 'Active')]);

    expect(await facade.monitoredCattle('ranch-1', { activeOnly: true, lotId: 'lot-1' }, 201)).toEqual([
      { cattleId: 'cattle-1', earTag: 'tag-cattle-1', status: 'Active', lifeStage: 'Calf' },
    ]);
    expect(cattleRepository.list).toHaveBeenCalledWith('ranch-1', { status: 'Active', lotId: 'lot-1' }, 1, 100);
  });

  it('lists every animal without filters when monitoring asks for the whole ranch', async () => {
    cattleRepository.list.mockResolvedValue([cattle('cattle-1', 'Active')]);

    await facade.monitoredCattle('ranch-1', { activeOnly: false }, Number.POSITIVE_INFINITY);

    expect(cattleRepository.list).toHaveBeenCalledWith('ranch-1', {}, 1, 100);
  });

  it('reads one animal for monitoring from its profile without the collar data', async () => {
    cattleRepository.profile.mockResolvedValue({
      cattle: cattle('cattle-7', 'Inactive'),
      device: { isAvailable: false, collarId: 'collar-9', lastReadingReceivedAt: null },
    });

    expect(await facade.monitoredCattleById('ranch-1', 'cattle-7')).toEqual({
      cattleId: 'cattle-7', earTag: 'tag-cattle-7', status: 'Inactive', lifeStage: 'Calf',
    });
    expect(cattleRepository.profile).toHaveBeenCalledWith('ranch-1', 'cattle-7');
  });

  it('lists each lot with the identities of its members', async () => {
    lotRepository.list.mockResolvedValueOnce([{
      id: 'lot-1', ranchId: 'ranch-1', name: 'Milking group', criterion: null, version: 'v1',
      memberships: [{ cattleId: 'cattle-1', assignedAt: '2026-11-01T00:00:00Z' }, { cattleId: 'cattle-2', assignedAt: '2026-11-02T00:00:00Z' }],
    }]);

    expect(await facade.lotMembers('ranch-1')).toEqual([
      { lotId: 'lot-1', name: 'Milking group', cattleIds: ['cattle-1', 'cattle-2'] },
    ]);
  });
});
