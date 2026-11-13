import { summarizeSeries } from './telemetry-statistics';

describe('summarizeSeries', () => {
  it('reports no statistics when there are no valid readings', () => {
    expect(summarizeSeries([], null)).toEqual({
      count: 0, min: null, max: null, mean: null, standardDeviation: null, outsideBandPercent: null,
    });
  });

  it('ignores absent or invalid readings instead of counting them as zero', () => {
    const statistics = summarizeSeries([38, null, 40], null);

    expect(statistics.count).toBe(2);
    expect(statistics.min).toBe(38);
    expect(statistics.mean).toBe(39);
  });

  it('uses the sample standard deviation, which needs at least two readings', () => {
    const statistics = summarizeSeries([38.5, 39.5, 40.5], null);

    expect(statistics.standardDeviation).toBeCloseTo(1, 10);
    expect(summarizeSeries([39], null).standardDeviation).toBeNull();
  });

  it('reports the share of valid readings outside the threshold band', () => {
    const statistics = summarizeSeries([37, 38, 40, 41], { min: 38, max: 40 });

    expect(statistics.outsideBandPercent).toBe(50);
  });

  it('leaves the band share empty when no threshold applies', () => {
    expect(summarizeSeries([37, 41], null).outsideBandPercent).toBeNull();
  });
});
