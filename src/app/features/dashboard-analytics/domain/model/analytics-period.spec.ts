import { customPeriod, localDay, localDayStart, presetPeriod } from './analytics-period';

describe('analytics periods', () => {
  const now = new Date(2026, 10, 11, 15);

  it('covers the preset number of calendar days, today included, in local time', () => {
    const period = presetPeriod(7, now);

    expect(period.from).toEqual(new Date(2026, 10, 5));
    expect(period.to).toEqual(new Date(2026, 10, 12));
  });

  it('covers both chosen days of a custom range, with the end at the start of the day after the last one', () => {
    expect(customPeriod(new Date(2026, 10, 1, 13), new Date(2026, 10, 30, 9))).toEqual({
      from: new Date(2026, 10, 1),
      to: new Date(2026, 11, 1),
    });
  });

  it('accepts a single day and rejects a last day before the first', () => {
    expect(customPeriod(new Date(2026, 10, 5), new Date(2026, 10, 5))).toEqual({
      from: new Date(2026, 10, 5),
      to: new Date(2026, 10, 6),
    });
    expect(customPeriod(new Date(2026, 10, 6), new Date(2026, 10, 5))).toBeNull();
  });

  it('writes a local day as yyyy-MM-dd and reads it back as local midnight', () => {
    expect(localDay(new Date(2026, 0, 9, 23))).toBe('2026-01-09');
    expect(localDayStart('2026-01-09')).toEqual(new Date(2026, 0, 9));
  });
});
