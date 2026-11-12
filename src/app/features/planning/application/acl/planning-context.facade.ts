import { inject, Injectable } from '@angular/core';
import { addDays, endOfDay } from '../../domain/model/planning-time';
import { withdrawalProgress, type WithdrawalState } from '../../domain/model/withdrawal-period.model';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';

/** A withdrawal period as other contexts read it: its bounds and its state at the moment of reading. */
export interface WithdrawalSummary {
  readonly state: WithdrawalState;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly daysRemaining: number | null;
}

/** A scheduled activity as other contexts read it: its title, its instant and the animal it names, if any. */
export interface UpcomingActivitySummary {
  readonly title: string;
  readonly scheduledAt: string;
  readonly cattleId: string | null;
}

/** Publishes withdrawal periods and upcoming work to other contexts, which never read Planning's models. */
@Injectable()
export class PlanningContextFacade {
  private readonly periods = inject(WithdrawalPeriodRepository);
  private readonly activities = inject(PlannedActivityRepository);

  /** Lists the activities scheduled from now until the end of the day `days` ahead, earliest first. */
  async upcomingActivities(ranchId: string, days: number): Promise<readonly UpcomingActivitySummary[]> {
    const now = new Date();
    const activities = await this.activities.calendar(ranchId, { from: now, to: endOfDay(addDays(now, days)) });
    return activities
      .map(activity => ({ title: activity.title, scheduledAt: activity.scheduledAt, cattleId: activity.cattleId }))
      .sort((first, second) => Date.parse(first.scheduledAt) - Date.parse(second.scheduledAt));
  }

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
