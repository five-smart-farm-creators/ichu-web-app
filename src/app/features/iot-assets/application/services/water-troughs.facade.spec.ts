import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade, type LotSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import type { WaterTrough } from '../../domain/model/water-trough.model';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';
import { WaterTroughsFacade } from './water-troughs.facade';

const RANCH = 'ranch-1';

function trough(id: string, name: string, overrides: Partial<WaterTrough> = {}): WaterTrough {
  return { id, ranchId: RANCH, name, lotId: null, temperatureRange: null, version: 'version-' + id, ...overrides };
}

describe('WaterTroughsFacade', () => {
  let facade: WaterTroughsFacade;
  let troughRepository: {
    list: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    configureTemperatureRange: ReturnType<typeof vi.fn>;
  };
  let cattleContext: { lotSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    troughRepository = {
      list: vi.fn(async () => [] as WaterTrough[]),
      register: vi.fn(),
      configureTemperatureRange: vi.fn(),
    };
    cattleContext = { lotSummaries: vi.fn(async () => [] as LotSummary[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        WaterTroughsFacade,
        { provide: WaterTroughRepository, useValue: troughRepository },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
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
});
