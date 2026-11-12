import {
  isValidPlanValidity, isValidRationQuantity, isValidTargetGain, lotDailyKilograms, rationChangeDays,
} from './nutrition-plan.model';

describe('nutrition plan rules', () => {
  it('accepts a ration quantity above zero and up to 100 kilograms per head per day', () => {
    expect(isValidRationQuantity(0.5)).toBe(true);
    expect(isValidRationQuantity(100)).toBe(true);
    expect(isValidRationQuantity(0)).toBe(false);
    expect(isValidRationQuantity(100.1)).toBe(false);
    expect(isValidRationQuantity(null)).toBe(false);
  });

  it('treats the target gain as optional and bounds it above zero and up to 3 kilograms a day', () => {
    expect(isValidTargetGain(null)).toBe(true);
    expect(isValidTargetGain(3)).toBe(true);
    expect(isValidTargetGain(0)).toBe(false);
    expect(isValidTargetGain(3.2)).toBe(false);
  });

  it('keeps an open end valid and refuses an end before the start', () => {
    expect(isValidPlanValidity('2026-11-05', null)).toBe(true);
    expect(isValidPlanValidity('2026-11-05', '2026-11-05')).toBe(true);
    expect(isValidPlanValidity('2026-11-05', '2026-11-04')).toBe(false);
  });

  it('estimates the daily feed of the lot as the ration of each head times the head count', () => {
    const ration = [
      { feed: 'Pasture', kind: 'Forage' as const, kilogramsPerHeadPerDay: 12 },
      { feed: 'Salt', kind: 'Mineral' as const, kilogramsPerHeadPerDay: 0.05 },
    ];

    expect(lotDailyKilograms(ration, 40)).toBeCloseTo(482, 6);
  });

  it('marks every ration change after the first plan on the day it starts', () => {
    expect(rationChangeDays([{ validFrom: '2026-11-05' }, { validFrom: '2026-10-01' }, { validFrom: '2026-12-01' }]))
      .toEqual(new Set(['2026-11-05', '2026-12-01']));
  });
});
