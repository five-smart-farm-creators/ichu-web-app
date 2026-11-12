import {
  attackRatePercent, cumulativeCases, dailyCases, movingAverage, peakDay, totalCases,
} from './epidemiological-statistics';

describe('epidemiological statistics', () => {
  it('keeps the days between the first and last case at zero, so the curve has no gaps', () => {
    expect(dailyCases({ '2026-11-02': 2, '2026-11-05': 1 })).toEqual([
      { day: '2026-11-02', cases: 2 },
      { day: '2026-11-03', cases: 0 },
      { day: '2026-11-04', cases: 0 },
      { day: '2026-11-05', cases: 1 },
    ]);
    expect(dailyCases({})).toEqual([]);
  });

  it('accumulates cases day by day and totals them', () => {
    const series = dailyCases({ '2026-11-02': 2, '2026-11-04': 3 });

    expect(cumulativeCases(series)).toEqual([2, 2, 5]);
    expect(totalCases(series)).toBe(5);
  });

  it('averages the trailing window and leaves the first days without a full window empty', () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it('finds the earliest day with the most cases and reports no peak without cases', () => {
    const series = dailyCases({ '2026-11-02': 3, '2026-11-03': 1, '2026-11-05': 3 });

    expect(peakDay(series)).toEqual({ day: '2026-11-02', cases: 3 });
    expect(peakDay(dailyCases({ '2026-11-02': 0 }))).toBeNull();
  });

  it('expresses cases as a percentage of the herd, and never as zero when the herd is unknown', () => {
    expect(attackRatePercent(5, 50)).toBe(10);
    expect(attackRatePercent(5, null)).toBeNull();
    expect(attackRatePercent(5, 0)).toBeNull();
  });
});
