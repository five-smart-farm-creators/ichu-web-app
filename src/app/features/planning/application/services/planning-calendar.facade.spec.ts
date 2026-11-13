import { TestBed } from '@angular/core/testing';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { ActivityApplication, PlannedActivity } from '../../domain/model/planned-activity.model';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { PLANNING_STATE_LIMIT, PlanningCalendarFacade } from './planning-calendar.facade';

const animals: MonitoredCattleSummary[] = [{ cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' }];

function activity(id: string, scheduledAt: Date, cattleId: string | null = null): PlannedActivity {
  return { id, campaignId: null, cattleId, title: 'Activity ' + id, scheduledAt: scheduledAt.toISOString() };
}

function application(activityId: string): ActivityApplication {
  return { id: 'application-' + activityId, activityId, cattleId: 'cattle-1', appliedAt: '2026-11-09T08:00:00.000Z', interventionId: null };
}

describe('PlanningCalendarFacade', () => {
  let facade: PlanningCalendarFacade;
  let activities: { calendar: ReturnType<typeof vi.fn>; listApplications: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattle: ReturnType<typeof vi.fn> };
  let monthActivities: PlannedActivity[];

  beforeEach(() => {
    // Wednesday 11 November 2026, midday local time.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 11, 12, 0));
    monthActivities = [
      activity('done', new Date(2026, 10, 9, 10, 0), 'cattle-1'),
      activity('overdue', new Date(2026, 10, 9, 15, 0)),
      activity('tomorrow', new Date(2026, 10, 12, 9, 0)),
      activity('later', new Date(2026, 10, 12, 16, 0)),
    ];
    activities = {
      calendar: vi.fn(async () => monthActivities),
      listApplications: vi.fn(async (_ranchId: string, activityId: string) => (activityId === 'done' ? [application('done')] : [])),
    };
    cattleContext = { monitoredCattle: vi.fn(async () => animals) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlanningCalendarFacade,
        { provide: PlannedActivityRepository, useValue: activities },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(PlanningCalendarFacade);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('loads the visible month and the reminder window, reading the applications of each activity', async () => {
    await facade.open('ranch-1');

    expect(activities.calendar).toHaveBeenCalledTimes(2);
    expect(activities.calendar.mock.calls[0][1].from).toEqual(new Date(2026, 10, 1));
    expect(activities.calendar.mock.calls[1][1].from).toEqual(new Date(2026, 9, 12));
    expect(activities.listApplications).toHaveBeenCalledWith('ranch-1', 'done');
    expect(facade.monthEntries().map(entry => entry.progress.state)).toEqual(['Done', 'Overdue', 'Scheduled', 'Scheduled']);
  });

  it('counts the activities of each local day for the grid chips', async () => {
    await facade.open('ranch-1');

    expect(facade.countsByDay().get('2026-11-09')).toBe(2);
    expect(facade.countsByDay().get('2026-11-12')).toBe(2);
    expect(facade.countsByDay().get('2026-11-13')).toBeUndefined();
  });

  it('lists the activities of the selected day and clears the selection when the day is left', async () => {
    await facade.open('ranch-1');

    facade.selectDay('2026-11-12');

    expect(facade.selectedEntries().map(entry => entry.activity.id)).toEqual(['tomorrow', 'later']);
  });

  it('shows the overdue work as a reminder with its days late and the next week as upcoming', async () => {
    await facade.open('ranch-1');

    expect(facade.reminders().overdue.map(entry => entry.activity.id)).toEqual(['overdue']);
    expect(facade.reminders().overdue[0].progress.daysLate).toBe(1);
    expect(facade.reminders().upcoming.map(entry => entry.activity.id)).toEqual(['tomorrow', 'later']);
  });

  it('names the animal of an activity from the animals of the ranch', async () => {
    await facade.open('ranch-1');

    expect(facade.earTag('cattle-1')).toBe('101');
    expect(facade.earTag(null)).toBe('');
    expect(facade.earTag('cattle-unknown')).toBe('');
  });

  it('flags a period beyond the state limit and states only the first activities', async () => {
    monthActivities = Array.from({ length: PLANNING_STATE_LIMIT + 1 }, (_, index) =>
      activity('bulk-' + index, new Date(2026, 10, 12, 8, 0)));

    await facade.open('ranch-1');

    expect(facade.limited()).toBe(true);
    expect(facade.monthEntries()).toHaveLength(PLANNING_STATE_LIMIT);

    monthActivities = [activity('single', new Date(2026, 11, 2, 8, 0))];
    await facade.shiftMonth(1);

    expect(facade.limited()).toBe(false);
  });

  it('moves to another month and clears the selected day, which may now be outside it', async () => {
    await facade.open('ranch-1');
    facade.selectDay('2026-11-12');

    await facade.shiftMonth(1);

    expect(facade.visibleMonth()).toEqual(new Date(2026, 11, 1));
    expect(facade.selectedDay()).toBeNull();
    expect(activities.calendar.mock.calls.at(-1)?.[1].from).toEqual(new Date(2026, 11, 1));
  });
});
