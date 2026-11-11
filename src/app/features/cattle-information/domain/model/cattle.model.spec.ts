import { type Cattle, ageInMonths, earliestEffectiveDay, fromIsoDate, toIsoDate } from './cattle.model';

function cattle(overrides: Partial<Cattle> = {}): Cattle {
  return {
    id: 'cattle-1',
    ranchId: 'ranch-1',
    earTag: '101',
    breed: 'Criollo',
    sex: 'Female',
    birthDate: '2025-01-10',
    currentStage: 'Calf',
    status: 'Active',
    exitReason: null,
    exitDate: null,
    version: 'version-1',
    stagePeriods: [],
    ...overrides,
  };
}

describe('cattle model rules', () => {
  it('counts whole months and waits for the birth day of the month', () => {
    expect(ageInMonths('2025-01-10', '2026-11-11')).toBe(22);
    expect(ageInMonths('2025-01-12', '2026-11-11')).toBe(21);
  });

  it('reads a birth date in the future as zero months', () => {
    expect(ageInMonths('2026-12-01', '2026-11-11')).toBe(0);
  });

  it('formats the local day for the API and reads it back as local midnight', () => {
    expect(toIsoDate(new Date(2026, 10, 11, 23, 59))).toBe('2026-11-11');
    expect(toIsoDate(fromIsoDate('2026-03-01'))).toBe('2026-03-01');
  });

  it('starts effective dates at the open stage and never before the birth date', () => {
    const animal = cattle({
      stagePeriods: [
        { id: 'period-1', lifeStage: 'Calf', validFrom: '2025-01-10', validTo: '2025-06-01' },
        { id: 'period-2', lifeStage: 'Heifer', validFrom: '2025-06-01', validTo: null },
      ],
    });

    expect(earliestEffectiveDay(animal)).toBe('2025-06-01');
    expect(earliestEffectiveDay(cattle({ stagePeriods: [] }))).toBe('2025-01-10');
  });
});
