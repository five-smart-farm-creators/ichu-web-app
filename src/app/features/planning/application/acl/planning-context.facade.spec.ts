import { TestBed } from '@angular/core/testing';
import type { PlannedActivity } from '../../domain/model/planned-activity.model';
import type { WithdrawalPeriod } from '../../domain/model/withdrawal-period.model';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';
import { PlanningContextFacade } from './planning-context.facade';

describe('PlanningContextFacade', () => {
  let facade: PlanningContextFacade;
  let periods: { list: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn> };
  let activities: { calendar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    const stored: WithdrawalPeriod[] = [
      { id: 'later', cattleId: 'cattle-1', interventionId: null, startsAt: '2026-11-20T00:00:00Z', endsAt: '2026-11-22T00:00:00Z' },
      { id: 'current', cattleId: 'cattle-1', interventionId: 'operation-1', startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-12T12:00:00Z' },
    ];
    periods = { list: vi.fn(async () => stored), record: vi.fn() };
    activities = { calendar: vi.fn(async (): Promise<PlannedActivity[]> => []) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlanningContextFacade,
        { provide: WithdrawalPeriodRepository, useValue: periods },
        { provide: PlannedActivityRepository, useValue: activities },
      ],
    });
    facade = TestBed.inject(PlanningContextFacade);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('publishes an animal\'s periods earliest first, each with its state and days left', async () => {
    const summaries = await facade.withdrawalPeriodsFor('ranch-1', 'cattle-1');

    expect(periods.list).toHaveBeenCalledWith('ranch-1', 'cattle-1');
    expect(summaries).toEqual([
      { state: 'Active', startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-12T12:00:00Z', daysRemaining: 1 },
      { state: 'Upcoming', startsAt: '2026-11-20T00:00:00Z', endsAt: '2026-11-22T00:00:00Z', daysRemaining: null },
    ]);
  });

  it('publishes the work scheduled until the end of the day N days ahead, earliest first, without ids', async () => {
    vi.setSystemTime(new Date(2026, 10, 11, 12));
    activities.calendar.mockResolvedValue([
      { id: 'activity-2', campaignId: null, cattleId: 'cattle-2', title: 'Second', scheduledAt: '2026-11-14T08:00:00Z' },
      { id: 'activity-1', campaignId: 'campaign-1', cattleId: null, title: 'First', scheduledAt: '2026-11-12T08:00:00Z' },
    ]);

    expect(await facade.upcomingActivities('ranch-1', 7)).toEqual([
      { title: 'First', scheduledAt: '2026-11-12T08:00:00Z', cattleId: null },
      { title: 'Second', scheduledAt: '2026-11-14T08:00:00Z', cattleId: 'cattle-2' },
    ]);
    expect(activities.calendar).toHaveBeenCalledWith('ranch-1', {
      from: new Date(2026, 10, 11, 12),
      to: new Date(2026, 10, 18, 23, 59, 59, 999),
    });
  });
});
