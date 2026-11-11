import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { Cattle, RegisterCattle } from '../../domain/model/cattle.model';
import type { Lot } from '../../domain/model/lot.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { CattleInventoryFacade, CATTLE_PAGE_SIZE, EXPORT_ROW_LIMIT } from './cattle-inventory.facade';

const RANCH = 'ranch-1';

function cattle(id: string): Cattle {
  return {
    id, ranchId: RANCH, earTag: id, breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10', currentStage: 'Calf',
    status: 'Active', exitReason: null, exitDate: null, version: 'version-1', stagePeriods: [],
  };
}

function animals(count: number, prefix = 'cattle'): Cattle[] {
  return Array.from({ length: count }, (_, index) => cattle(`${prefix}-${index}`));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

const registration: RegisterCattle = {
  earTag: '900', breed: 'Fleckvieh', sex: 'Male', birthDate: '2026-02-01', lifeStage: 'Calf',
};

describe('CattleInventoryFacade', () => {
  let facade: CattleInventoryFacade;
  let cattleRepository: { list: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn> };
  let lotRepository: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cattleRepository = { list: vi.fn(async () => [] as Cattle[]), register: vi.fn() };
    lotRepository = { list: vi.fn(async () => [] as Lot[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CattleInventoryFacade,
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: lotRepository },
      ],
    });
    facade = TestBed.inject(CattleInventoryFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens a ranch on its first page and asks for one extra animal to learn whether more follow', async () => {
    cattleRepository.list.mockResolvedValue(animals(3));

    await facade.open(RANCH);

    expect(cattleRepository.list).toHaveBeenCalledWith(RANCH, {}, 1, CATTLE_PAGE_SIZE + 1);
    expect(facade.rows()).toHaveLength(3);
    expect(facade.hasNextPage()).toBe(false);
  });

  it('shows one full page and reports a next page when the extra animal arrives', async () => {
    cattleRepository.list.mockResolvedValue(animals(CATTLE_PAGE_SIZE + 1));

    await facade.open(RANCH);

    expect(facade.rows()).toHaveLength(CATTLE_PAGE_SIZE);
    expect(facade.hasNextPage()).toBe(true);
  });

  it('moves between server pages with the current page size and filter', async () => {
    await facade.open(RANCH);
    await facade.goToPage(2, 10);

    expect(cattleRepository.list).toHaveBeenLastCalledWith(RANCH, {}, 3, 11);
    expect(facade.pageIndex()).toBe(2);
    expect(facade.pageSize()).toBe(10);
  });

  it('applies a new filter from the first page', async () => {
    await facade.open(RANCH);
    await facade.goToPage(2, 10);

    await facade.search({ status: 'Inactive' });

    expect(cattleRepository.list).toHaveBeenLastCalledWith(RANCH, { status: 'Inactive' }, 1, 11);
    expect(facade.pageIndex()).toBe(0);
    expect(facade.filter()).toEqual({ status: 'Inactive' });
  });

  it('registers an animal and then refreshes the page it is listed on', async () => {
    cattleRepository.register.mockResolvedValue(cattle('new-animal'));
    await facade.open(RANCH);

    const created = await facade.register(registration);

    expect(cattleRepository.register).toHaveBeenCalledWith(RANCH, registration);
    expect(created.id).toBe('new-animal');
    expect(cattleRepository.list).toHaveBeenCalledTimes(2);
  });

  it('leaves the list untouched and rejects with the API error when a registration is refused', async () => {
    cattleRepository.list.mockResolvedValue(animals(2));
    cattleRepository.register.mockRejectedValue(new ApiError(409, 'CattleInformation.DuplicateEarTag', 'Ear tag in use.'));
    await facade.open(RANCH);

    await expect(facade.register(registration)).rejects.toMatchObject({ code: 'CattleInformation.DuplicateEarTag' });
    expect(facade.rows()).toHaveLength(2);
    expect(facade.error()).toBeNull();
  });

  it('clears the rows and shows the error when a page fails', async () => {
    cattleRepository.list.mockResolvedValue(animals(2));
    await facade.open(RANCH);
    cattleRepository.list.mockRejectedValue(new ApiError(500, 'http-500', null));

    await facade.goToPage(1, CATTLE_PAGE_SIZE);

    expect(facade.rows()).toEqual([]);
    expect(facade.error()).toMatchObject({ code: 'http-500' });
    expect(facade.loading()).toBe(false);
  });

  it('discards a page that an newer request has replaced', async () => {
    const stale = deferred<Cattle[]>();
    cattleRepository.list
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(animals(1, 'fresh'));

    const opening = facade.open(RANCH);
    await facade.search({ earTag: 'fresh' });
    stale.resolve(animals(2, 'stale'));
    await opening;

    expect(facade.rows().map(animal => animal.id)).toEqual(['fresh-0']);
  });

  it('names every lot that contains an animal', async () => {
    const lots: Lot[] = [
      { id: 'lot-a', ranchId: RANCH, name: 'Lot A', criterion: null, version: 'v1', memberships: [{ cattleId: 'cattle-0', assignedAt: '2026-01-01T00:00:00Z' }] },
      { id: 'lot-b', ranchId: RANCH, name: 'Lot B', criterion: null, version: 'v1', memberships: [{ cattleId: 'cattle-0', assignedAt: '2026-01-01T00:00:00Z' }] },
    ];
    lotRepository.list.mockResolvedValue(lots);

    await facade.open(RANCH);

    expect(facade.lotNames('cattle-0')).toBe('Lot A, Lot B');
    expect(facade.lotNames('cattle-9')).toBe('');
  });

  it('collects every page of the filter for an export and stops at the export limit', async () => {
    cattleRepository.list.mockImplementation(async (_ranch: string, _filter: unknown, _page: number, pageSize: number) =>
      pageSize === 100 ? animals(100, 'export') : []);
    await facade.open(RANCH);

    const rows = await facade.exportRows();

    expect(rows).toHaveLength(EXPORT_ROW_LIMIT);
    expect(cattleRepository.list).toHaveBeenCalledWith(RANCH, {}, 50, 100);
  });
});
