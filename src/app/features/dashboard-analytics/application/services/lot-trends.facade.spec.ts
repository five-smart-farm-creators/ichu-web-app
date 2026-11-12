import { TestBed } from '@angular/core/testing';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { AnimalComparison, TrendQuery, TrendSeries } from '../../domain/model/lot-trend.model';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { LotTrendsFacade } from './lot-trends.facade';

const period: AnalyticsPeriod = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

function series(overrides: Partial<TrendSeries> = {}): TrendSeries {
  return {
    ranchId: 'ranch-1', lotId: 'lot-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' },
    updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform', metric: 'body-temperature', unit: 'celsius',
    lotAverage: 39, outlierDeviation: 1, points: [], outlierAnimals: [], missingReadings: null,
    coverageReason: null, unavailableReason: null, ...overrides,
  };
}

/** Three animals whose averages are 38, 39 and 40: the sample standard deviation is exactly 1. */
const spreadPoints = [
  { cattleId: 'cattle-1', recordedAt: '2026-11-10T08:00:00Z', value: 38 },
  { cattleId: 'cattle-2', recordedAt: '2026-11-10T08:00:00Z', value: 39 },
  { cattleId: 'cattle-3', recordedAt: '2026-11-10T08:00:00Z', value: 40 },
];

describe('LotTrendsFacade', () => {
  let facade: LotTrendsFacade;
  let trends: { lotTrend: ReturnType<typeof vi.fn>; animalComparison: ReturnType<typeof vi.fn> };
  let cattle: { lotMembers: ReturnType<typeof vi.fn>; cattleSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    trends = {
      lotTrend: vi.fn(),
      animalComparison: vi.fn(async (): Promise<AnimalComparison> => ({
        cattleId: 'cattle-3', reference: series(), animalAverage: 40, deviation: 1, referenceAnimalCount: 3, unavailableReason: null,
      })),
    };
    cattle = {
      lotMembers: vi.fn(async () => [
        { lotId: 'lot-1', name: 'Milking group', cattleIds: ['cattle-1', 'cattle-2'] },
        { lotId: 'lot-2', name: 'Dry cows', cattleIds: ['cattle-3'] },
      ]),
      cattleSummaries: vi.fn(async () => [
        { cattleId: 'cattle-1', earTag: '101', status: 'Active' },
        { cattleId: 'cattle-2', earTag: '102', status: 'Active' },
        { cattleId: 'cattle-3', earTag: '103', status: 'Active' },
      ]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LotTrendsFacade,
        { provide: LotTrendRepository, useValue: trends },
        { provide: CattleInformationContextFacade, useValue: cattle },
      ],
    });
    facade = TestBed.inject(LotTrendsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads the spread first, then asks for the threshold of two standard deviations in the metric unit', async () => {
    trends.lotTrend.mockImplementation(async (_ranch: string, query: TrendQuery) => query.deviation === 1
      ? series({ points: spreadPoints })
      : series({ points: spreadPoints, outlierAnimals: ['cattle-3'], outlierDeviation: query.deviation }));

    await facade.open('ranch-1', period);

    expect(trends.lotTrend.mock.calls.map(call => (call[1] as TrendQuery).deviation)).toEqual([1, 2]);
    expect(facade.spread()).toBeCloseTo(1, 10);
    expect(facade.threshold()).toBeCloseTo(2, 10);
    expect(facade.outliers()).toEqual([{ cattleId: 'cattle-3', earTag: '103', average: 40, deviation: 1 }]);
  });

  it('flags no animal and reads the lot once when every animal has the same average', async () => {
    trends.lotTrend.mockResolvedValue(series({
      points: [
        { cattleId: 'cattle-1', recordedAt: '2026-11-10T08:00:00Z', value: 39 },
        { cattleId: 'cattle-2', recordedAt: '2026-11-10T08:00:00Z', value: 39 },
      ],
    }));

    await facade.open('ranch-1', period);

    expect(trends.lotTrend).toHaveBeenCalledTimes(1);
    expect(facade.threshold()).toBeNull();
    expect(facade.series()?.outlierAnimals).toEqual([]);
  });

  it('selects the lot and the animal of a preferred animal once, so a later choice is not overwritten', async () => {
    trends.lotTrend.mockResolvedValue(series({ points: spreadPoints }));

    await facade.open('ranch-1', period, 'cattle-3');
    expect(facade.lotId()).toBe('lot-2');
    expect(facade.cattleId()).toBe('cattle-3');

    await facade.selectAnimal(null);
    await facade.open('ranch-1', period, 'cattle-3');
    expect(facade.cattleId()).toBeNull();
    expect(cattle.lotMembers).toHaveBeenCalledTimes(1);
  });

  it('passes the threshold to the comparison and returns the animal comparison from the API', async () => {
    trends.lotTrend.mockImplementation(async (_ranch: string, query: TrendQuery) => series({ points: spreadPoints, outlierDeviation: query.deviation }));

    await facade.open('ranch-1', period);
    await facade.selectAnimal('cattle-3');

    expect(trends.animalComparison).toHaveBeenCalledWith('ranch-1', 'cattle-3', {
      lotId: 'lot-1', period, metric: 'body-temperature', deviation: expect.closeTo(2, 10),
    });
    expect(facade.comparison()?.animalAverage).toBe(40);
  });

  it('clears the animal when the new lot does not contain it', async () => {
    trends.lotTrend.mockResolvedValue(series({ points: spreadPoints }));
    await facade.open('ranch-1', period, 'cattle-3');

    await facade.selectLot('lot-1');

    expect(facade.cattleId()).toBeNull();
    expect(facade.comparison()).toBeNull();
  });

  it('keeps the spread and the threshold for the current ranch only', async () => {
    trends.lotTrend.mockResolvedValue(series({ points: spreadPoints }));
    await facade.open('ranch-1', period);

    await facade.open(null, period);

    expect(facade.series()).toBeNull();
    expect(facade.threshold()).toBeNull();
    expect(facade.lots()).toEqual([]);
  });
});
