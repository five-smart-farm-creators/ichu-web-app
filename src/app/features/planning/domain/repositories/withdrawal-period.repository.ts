import type { RecordWithdrawalPeriod, WithdrawalPeriod } from '../model/withdrawal-period.model';

/** Lists and records the withdrawal periods of one ranch, optionally narrowed to one animal. */
export abstract class WithdrawalPeriodRepository {
  abstract list(ranchId: string, cattleId: string | null): Promise<readonly WithdrawalPeriod[]>;
  abstract record(ranchId: string, request: RecordWithdrawalPeriod): Promise<WithdrawalPeriod>;
}
