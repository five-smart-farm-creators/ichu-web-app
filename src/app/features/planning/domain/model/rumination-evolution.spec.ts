import {
  type DailyRumination, dailyRuminationMeans, ruminationAroundChange, ruminationWindow,
} from './rumination-evolution';

describe('dailyRuminationMeans', () => {
  it('averages each animal per local day, then the animals of each day, skipping invalid values', () => {
    const readings = [
      { cattleId: 'a', recordedAt: new Date(2026, 10, 4, 8).toISOString(), value: 400 },
      { cattleId: 'a', recordedAt: new Date(2026, 10, 4, 18).toISOString(), value: 440 },
      { cattleId: 'b', recordedAt: new Date(2026, 10, 4, 9).toISOString(), value: 500 },
      { cattleId: 'a', recordedAt: new Date(2026, 10, 5, 8).toISOString(), value: Number.NaN },
    ];

    expect(dailyRuminationMeans(readings)).toEqual([{ day: '2026-11-04', value: (420 + 500) / 2, animalCount: 2 }]);
  });
});

describe('ruminationAroundChange', () => {
  const days: DailyRumination[] = [
    { day: '2026-11-03', value: 400, animalCount: 2 },
    { day: '2026-11-04', value: 420, animalCount: 2 },
    { day: '2026-11-05', value: 470, animalCount: 2 },
    { day: '2026-11-06', value: 490, animalCount: 2 },
  ];

  it('compares the days before the change with the days from its day onward', () => {
    expect(ruminationAroundChange(days, '2026-11-05')).toEqual({ before: 410, after: 480 });
  });

  it('leaves a side without days empty', () => {
    expect(ruminationAroundChange(days, '2026-11-01')).toEqual({ before: null, after: 445 });
    expect(ruminationAroundChange(days, '2026-12-01')).toEqual({ before: 445, after: null });
  });
});

describe('ruminationWindow', () => {
  const today = new Date(2026, 10, 12, 15);

  it('opens 30 days before the current plan starts and ends tomorrow', () => {
    expect(ruminationWindow(today, '2026-11-05')).toEqual({ from: new Date(2026, 9, 6), to: new Date(2026, 10, 13) });
  });

  it('never reaches further back than 90 days', () => {
    expect(ruminationWindow(today, '2026-01-01')).toEqual({ from: new Date(2026, 7, 14), to: new Date(2026, 10, 13) });
  });

  it('covers the last 30 days when no plan is in force', () => {
    expect(ruminationWindow(today, null)).toEqual({ from: new Date(2026, 9, 14), to: new Date(2026, 10, 13) });
  });
});
