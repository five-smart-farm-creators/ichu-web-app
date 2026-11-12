import { inject, Injectable } from '@angular/core';
import { withdrawalProgress, type WithdrawalState } from '../../domain/model/withdrawal-period.model';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';

/** A withdrawal period as other contexts read it: its bounds and its state at the moment of reading. */
export interface WithdrawalSummary {
  readonly state: WithdrawalState;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly daysRemaining: number | null;
}

/** Publishes withdrawal periods to Operations and Monitoring, which never reads Planning's models. */
@Injectable()
export class PlanningContextFacade {
  private readonly periods = inject(WithdrawalPeriodRepository);

  /** Lists an animal's withdrawal periods, earliest first, with their state now. */
  async withdrawalPeriodsFor(ranchId: string, cattleId: string): Promise<readonly WithdrawalSummary[]> {
    const now = new Date();
    const periods = await this.periods.list(ranchId, cattleId);
    return periods
      .map(period => ({ period, progress: withdrawalProgress(period, now) }))
      .sort((first, second) => Date.parse(first.period.startsAt) - Date.parse(second.period.startsAt))
      .map(({ period, progress }) => ({
        state: progress.state,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        daysRemaining: progress.daysRemaining,
      }));
  }
}
