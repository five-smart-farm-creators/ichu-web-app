import {
  currentDaysOpen, pregnancyInProgress, reproductiveTimeline, type ReproductiveHistory,
} from './reproductive-history.model';

function history(overrides: Partial<ReproductiveHistory> = {}): ReproductiveHistory {
  return {
    cattleId: 'cattle-1', sex: 'Female', lifeStage: 'MilkingCow', ageInMonths: 48, hasHistory: true,
    services: [], pregnancyDiagnoses: [], calvings: [], abortions: [], heatsObserved: [], intervals: [],
    servicesPerPregnancy: null, pregnanciesConfirmed: 0, ...overrides,
  };
}

// Local dates keep the day counts independent of the time zone of the machine running the tests.
const calvedOn = new Date(2026, 9, 1, 8).toISOString();
const today = new Date(2026, 10, 12, 15);

describe('reproductiveTimeline', () => {
  it('lists every dated event newest first, with the details of each kind', () => {
    const timeline = reproductiveTimeline(history({
      services: [{ occurredAt: '2026-03-01T08:00:00Z', method: 'Insemination', sireReference: 'Bull 7' }],
      pregnancyDiagnoses: [{ occurredAt: '2026-04-01T08:00:00Z', result: 'Pregnant', expectedCalvingDate: '2027-01-02' }],
      calvings: [{ occurredAt: '2025-12-01T08:00:00Z' }],
      heatsObserved: [{ occurredAt: '2026-06-01T08:00:00Z' }],
    }));

    expect(timeline.map(entry => entry.kind)).toEqual(['heat', 'diagnosis', 'service', 'calving']);
    expect(timeline[1]).toEqual({
      kind: 'diagnosis', occurredAt: '2026-04-01T08:00:00Z', method: null, result: 'Pregnant', sireReference: null, expectedCalvingDate: '2027-01-02',
    });
    expect(timeline[2]).toEqual({
      kind: 'service', occurredAt: '2026-03-01T08:00:00Z', method: 'Insemination', result: null, sireReference: 'Bull 7', expectedCalvingDate: null,
    });
  });
});

describe('pregnancyInProgress', () => {
  it('returns the latest pregnant diagnosis when no calving or abortion followed it', () => {
    const diagnosis = { occurredAt: '2026-08-01T08:00:00Z', result: 'Pregnant', expectedCalvingDate: '2027-05-01' } as const;

    expect(pregnancyInProgress(history({ pregnancyDiagnoses: [diagnosis] }))).toEqual(diagnosis);
  });

  it('is null when a later open diagnosis, or a later abortion, ends the pregnancy', () => {
    const pregnant = { occurredAt: '2026-08-01T08:00:00Z', result: 'Pregnant', expectedCalvingDate: null } as const;
    const open = { occurredAt: '2026-09-01T08:00:00Z', result: 'Open', expectedCalvingDate: null } as const;

    expect(pregnancyInProgress(history({ pregnancyDiagnoses: [pregnant, open] }))).toBeNull();
    expect(pregnancyInProgress(history({ pregnancyDiagnoses: [pregnant], abortions: [{ occurredAt: '2026-10-01T08:00:00Z' }] }))).toBeNull();
  });
});

describe('currentDaysOpen', () => {
  it('counts the local days since the last calving while no pregnancy is in progress', () => {
    const open = history({ calvings: [{ occurredAt: calvedOn }] });

    expect(currentDaysOpen(open, today)).toBe(42);
  });

  it('is null while a pregnancy is in progress, and when the animal never calved', () => {
    const pregnant = history({
      calvings: [{ occurredAt: calvedOn }],
      pregnancyDiagnoses: [{ occurredAt: '2026-10-20T08:00:00Z', result: 'Pregnant', expectedCalvingDate: null }],
    });

    expect(currentDaysOpen(pregnant, today)).toBeNull();
    expect(currentDaysOpen(history(), today)).toBeNull();
  });

  it('counts again after a lost pregnancy, because the animal is open once more', () => {
    const lost = history({
      calvings: [{ occurredAt: calvedOn }],
      pregnancyDiagnoses: [{ occurredAt: '2026-10-20T08:00:00Z', result: 'Pregnant', expectedCalvingDate: null }],
      abortions: [{ occurredAt: '2026-11-05T08:00:00Z' }],
    });

    expect(currentDaysOpen(lost, today)).toBe(42);
  });
});
