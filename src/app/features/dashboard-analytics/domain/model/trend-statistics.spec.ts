import type { TrendPoint } from './lot-trend.model';
import {
  animalAverages, animalDailyMeans, dailyLotBands, dailyLotMeans, outlierThreshold,
  sampleStandardDeviation,
} from './trend-statistics';

function point(cattleId: string, value: number, recordedAt: Date): TrendPoint {
  return { cattleId, value, recordedAt: recordedAt.toISOString() };
}

describe('trend statistics', () => {
  it('averages each animal with equal weight per animal, skipping values that are not finite', () => {
    const points = [
      point('a', 38, new Date(2026, 10, 10, 8)),
      point('a', 40, new Date(2026, 10, 10, 9)),
      point('a', Number.NaN, new Date(2026, 10, 10, 10)),
      point('b', 37, new Date(2026, 10, 10, 8)),
    ];

    expect(animalAverages(points)).toEqual([
      { cattleId: 'a', average: 39, count: 2 },
      { cattleId: 'b', average: 37, count: 1 },
    ]);
  });

  it('uses the sample standard deviation, which needs two values', () => {
    expect(sampleStandardDeviation([38, 39, 40])).toBeCloseTo(1, 10);
    expect(sampleStandardDeviation([39])).toBeNull();
    expect(sampleStandardDeviation([])).toBeNull();
  });

  it('turns a spread and a multiplier into a deviation, and refuses a spread that cannot separate animals', () => {
    expect(outlierThreshold(1.5, 2)).toBe(3);
    expect(outlierThreshold(0, 2)).toBeNull();
    expect(outlierThreshold(null, 2)).toBeNull();
    expect(outlierThreshold(1, 0)).toBeNull();
  });

  it('gives each animal one mean per local day', () => {
    const points = [
      point('a', 38, new Date(2026, 10, 10, 8)),
      point('a', 40, new Date(2026, 10, 10, 20)),
      point('b', 36, new Date(2026, 10, 11, 8)),
    ];

    expect(animalDailyMeans(points)).toEqual([
      { cattleId: 'a', day: '2026-11-10', value: 39 },
      { cattleId: 'b', day: '2026-11-11', value: 36 },
    ]);
  });

  it('averages the animals of a day, so an animal with many readings does not dominate the lot', () => {
    const points = [
      point('a', 38, new Date(2026, 10, 10, 8)),
      point('a', 38, new Date(2026, 10, 10, 9)),
      point('a', 38, new Date(2026, 10, 10, 10)),
      point('b', 40, new Date(2026, 10, 10, 8)),
      point('a', 37, new Date(2026, 10, 11, 8)),
    ];

    expect(dailyLotMeans(points)).toEqual([
      { day: '2026-11-10', value: 39, animalCount: 2 },
      { day: '2026-11-11', value: 37, animalCount: 1 },
    ]);
  });

  it('bands each day with the spread of the daily means of the animals, which needs two animals', () => {
    const points = [
      point('a', 38, new Date(2026, 10, 10, 8)),
      point('b', 40, new Date(2026, 10, 10, 8)),
      point('a', 37, new Date(2026, 10, 11, 8)),
    ];

    expect(dailyLotBands(points)).toEqual([
      { day: '2026-11-10', mean: 39, spread: Math.SQRT2, animalCount: 2 },
      { day: '2026-11-11', mean: 37, spread: null, animalCount: 1 },
    ]);
  });
});
