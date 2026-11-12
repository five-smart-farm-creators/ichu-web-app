import type { ActivityProgress, ActivityState } from '../domain/model/planned-activity.model';

const STATE_TONE: Readonly<Record<ActivityState, string>> = { Done: 'success', Overdue: 'danger', Scheduled: 'neutral' };

/** Badge tone for an activity state; overdue work uses the danger tone with text, never color alone. */
export function activityStateTone(state: ActivityState): string {
  return STATE_TONE[state];
}

/** Translation key for an activity state; overdue work says how late it is, and one day needs its own wording. */
export function activityStateKey(progress: ActivityProgress): string {
  if (progress.state !== 'Overdue') return 'planning.state.' + progress.state;
  if (progress.daysLate === 0) return 'planning.state.Overdue';
  return progress.daysLate === 1 ? 'planning.state.overdueOne' : 'planning.state.overdueDays';
}
