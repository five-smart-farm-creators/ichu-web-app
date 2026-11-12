import { activityProgress, activityReminders, type PlannedActivity, type PlannedActivityEntry } from './planned-activity.model';

const now = new Date('2026-11-11T12:00:00Z');

function activity(id: string, scheduledAt: string): PlannedActivity {
  return { id, campaignId: null, cattleId: null, title: 'Vaccinate ' + id, scheduledAt };
}

function entry(id: string, scheduledAt: string, applications = 0): PlannedActivityEntry {
  const planned = activity(id, scheduledAt);
  return { activity: planned, progress: activityProgress(planned, applications, now) };
}

describe('activityProgress', () => {
  it('is done as soon as an application exists, even before the scheduled time', () => {
    expect(activityProgress(activity('a', '2026-11-20T08:00:00Z'), 1, now)).toEqual({ state: 'Done', daysLate: 0 });
  });

  it('is overdue after the scheduled time with whole days late', () => {
    expect(activityProgress(activity('a', '2026-11-08T12:00:00Z'), 0, now)).toEqual({ state: 'Overdue', daysLate: 3 });
  });

  it('is overdue with zero days late when it passed less than a day ago', () => {
    expect(activityProgress(activity('a', '2026-11-11T10:00:00Z'), 0, now)).toEqual({ state: 'Overdue', daysLate: 0 });
  });

  it('is scheduled while its time has not come', () => {
    expect(activityProgress(activity('a', '2026-11-12T08:00:00Z'), 0, now)).toEqual({ state: 'Scheduled', daysLate: 0 });
  });
});

describe('activityReminders', () => {
  it('lists undone work due by the window end, and overdue work oldest first', () => {
    const windowEnd = new Date('2026-11-18T23:59:59.999Z');
    const reminders = activityReminders([
      entry('upcoming-soon', '2026-11-12T08:00:00Z'),
      entry('upcoming-later', '2026-11-30T08:00:00Z'),
      entry('overdue-recent', '2026-11-09T08:00:00Z'),
      entry('overdue-older', '2026-11-05T08:00:00Z'),
      entry('done', '2026-11-06T08:00:00Z', 2),
    ], windowEnd);

    expect(reminders.upcoming.map(item => item.activity.id)).toEqual(['upcoming-soon']);
    expect(reminders.overdue.map(item => item.activity.id)).toEqual(['overdue-older', 'overdue-recent']);
  });
});
