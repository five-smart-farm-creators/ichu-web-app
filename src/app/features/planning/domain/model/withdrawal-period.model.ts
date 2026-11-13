import { DAY_MILLISECONDS } from './planning-time';

export const WITHDRAWAL_STATES = ['Active', 'Upcoming', 'Ended'] as const;
export type WithdrawalState = (typeof WITHDRAWAL_STATES)[number];

/** An interval the caller determined for one animal; Planning stores its bounds and never calculates them. */
export interface WithdrawalPeriod {
  readonly id: string;
  readonly cattleId: string;
  readonly interventionId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface RecordWithdrawalPeriod {
  readonly cattleId: string;
  readonly interventionId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface WithdrawalProgress {
  readonly state: WithdrawalState;
  /** Whole days left, rounded up so a part of a day still counts; null unless the period is active. */
  readonly daysRemaining: number | null;
}

/** Both bounds are inclusive, so the period is active from its start instant through its end instant. */
export function withdrawalProgress(period: Pick<WithdrawalPeriod, 'startsAt' | 'endsAt'>, now: Date): WithdrawalProgress {
  const current = now.getTime();
  if (current < Date.parse(period.startsAt)) return { state: 'Upcoming', daysRemaining: null };
  const end = Date.parse(period.endsAt);
  if (current > end) return { state: 'Ended', daysRemaining: null };
  return { state: 'Active', daysRemaining: Math.ceil((end - current) / DAY_MILLISECONDS) };
}

/** The API rejects a period that ends before it starts; equal instants are valid. */
export function isValidWithdrawalRange(startsAt: Date, endsAt: Date): boolean {
  return endsAt.getTime() >= startsAt.getTime();
}
