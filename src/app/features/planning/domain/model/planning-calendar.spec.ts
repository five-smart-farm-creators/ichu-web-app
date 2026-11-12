import { monthGrid, monthPeriod, reminderPeriod } from './planning-calendar';
import { localDay, parseLocalDay } from './planning-time';

describe('monthGrid', () => {
  it('starts English weeks on Sunday, so June 2026 begins with 31 May', () => {
    const weeks = monthGrid(new Date(2026, 5, 1), 0);

    expect(weeks).toHaveLength(6);
    expect(weeks.every(week => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toMatchObject({ day: '2026-05-31', inMonth: false });
    expect(weeks[0][1]).toMatchObject({ day: '2026-06-01', inMonth: true });
  });

  it('starts Spanish weeks on Monday, so June 2026 begins with 1 June', () => {
    const weeks = monthGrid(new Date(2026, 5, 1), 1);

    expect(weeks[0][0]).toMatchObject({ day: '2026-06-01', inMonth: true });
  });

  it('marks exactly the days of the visible month and lists the 42 days in order', () => {
    const days = monthGrid(new Date(2026, 5, 15), 1).flat();
    const keys = days.map(day => day.day);

    expect(days.filter(day => day.inMonth)).toHaveLength(30);
    expect(new Set(keys).size).toBe(42);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe('planning periods', () => {
  it('covers every local day of the visible month inclusively', () => {
    const period = monthPeriod(new Date(2026, 1, 15));

    expect(localDay(period.from)).toBe('2026-02-01');
    expect(localDay(period.to)).toBe('2026-02-28');
    expect(period.to.getHours()).toBe(23);
  });

  it('looks 30 days back and 7 days ahead from today', () => {
    const period = reminderPeriod(new Date(2026, 10, 11, 15, 30));

    expect(localDay(period.from)).toBe('2026-10-12');
    expect(localDay(period.to)).toBe('2026-11-18');
    expect(period.from.getHours()).toBe(0);
  });

  it('reads a yyyy-MM-dd day as local midnight', () => {
    const day = parseLocalDay('2026-11-11');

    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(10);
    expect(day.getDate()).toBe(11);
    expect(day.getHours()).toBe(0);
  });
});
