import { DAY_MILLISECONDS } from './planning-time';

/** Done once any application exists; otherwise overdue after the scheduled instant, and scheduled before it. */
export const ACTIVITY_STATES = ['Done', 'Overdue', 'Scheduled'] as const;
export type ActivityState = (typeof ACTIVITY_STATES)[number];

export interface PlannedActivity {
  readonly id: string;
  readonly campaignId: string | null;
  readonly cattleId: string | null;
  readonly title: string;
  readonly scheduledAt: string;
}

export interface ScheduleActivity {
  readonly campaignId: string | null;
  readonly cattleId: string | null;
  readonly title: string;
  readonly scheduledAt: string;
}

export interface ActivityApplication {
  readonly id: string;
  readonly activityId: string;
  readonly cattleId: string;
  readonly appliedAt: string;
  readonly interventionId: string | null;
}

export interface RecordApplication {
  readonly cattleId: string;
  readonly appliedAt: string;
  readonly interventionId: string | null;
}

export interface ActivityFollowUp {
  readonly id: string;
  readonly activityId: string;
  readonly dueAt: string;
}

export interface ScheduleFollowUp {
  readonly dueAt: string;
}

/** The state of an activity at one instant; `daysLate` counts whole days and is zero unless overdue. */
export interface ActivityProgress {
  readonly state: ActivityState;
  readonly daysLate: number;
}

export interface PlannedActivityEntry {
  readonly activity: PlannedActivity;
  readonly progress: ActivityProgress;
}

export interface ActivityReminders {
  readonly upcoming: readonly PlannedActivityEntry[];
  readonly overdue: readonly PlannedActivityEntry[];
}

export function activityProgress(activity: PlannedActivity, applicationCount: number, now: Date): ActivityProgress {
  if (applicationCount > 0) return { state: 'Done', daysLate: 0 };
  const elapsed = now.getTime() - Date.parse(activity.scheduledAt);
  return elapsed > 0
    ? { state: 'Overdue', daysLate: Math.floor(elapsed / DAY_MILLISECONDS) }
    : { state: 'Scheduled', daysLate: 0 };
}

/** Upcoming work is undone and due by the window end; overdue work is undone and past due. Both sort by schedule. */
export function activityReminders(entries: readonly PlannedActivityEntry[], windowEnd: Date): ActivityReminders {
  const bySchedule = (first: PlannedActivityEntry, second: PlannedActivityEntry): number =>
    Date.parse(first.activity.scheduledAt) - Date.parse(second.activity.scheduledAt);
  return {
    upcoming: entries
      .filter(entry => entry.progress.state === 'Scheduled' && Date.parse(entry.activity.scheduledAt) <= windowEnd.getTime())
      .sort(bySchedule),
    overdue: entries.filter(entry => entry.progress.state === 'Overdue').sort(bySchedule),
  };
}
