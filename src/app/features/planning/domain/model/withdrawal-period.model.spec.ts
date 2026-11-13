import { isValidWithdrawalRange, withdrawalProgress } from './withdrawal-period.model';

const period = { startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-13T00:00:00Z' };

describe('withdrawalProgress', () => {
  it('is upcoming before its start', () => {
    expect(withdrawalProgress(period, new Date('2026-11-09T23:00:00Z'))).toEqual({ state: 'Upcoming', daysRemaining: null });
  });

  it('is active from its start instant, with a partial day counted as a whole day left', () => {
    expect(withdrawalProgress(period, new Date('2026-11-10T00:00:00Z'))).toEqual({ state: 'Active', daysRemaining: 3 });
    expect(withdrawalProgress(period, new Date('2026-11-12T12:00:00Z'))).toEqual({ state: 'Active', daysRemaining: 1 });
  });

  it('is active at its end instant and ended after it', () => {
    expect(withdrawalProgress(period, new Date('2026-11-13T00:00:00Z'))).toEqual({ state: 'Active', daysRemaining: 0 });
    expect(withdrawalProgress(period, new Date('2026-11-13T00:00:01Z'))).toEqual({ state: 'Ended', daysRemaining: null });
  });
});

describe('isValidWithdrawalRange', () => {
  it('accepts equal bounds and rejects an end before the start', () => {
    const start = new Date('2026-11-10T00:00:00Z');
    expect(isValidWithdrawalRange(start, start)).toBe(true);
    expect(isValidWithdrawalRange(start, new Date('2026-11-09T00:00:00Z'))).toBe(false);
  });
});
