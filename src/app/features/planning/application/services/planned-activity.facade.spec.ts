import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { ActivityApplication, ActivityFollowUp, PlannedActivity } from '../../domain/model/planned-activity.model';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { PlannedActivityFacade } from './planned-activity.facade';

const activity: PlannedActivity = {
  id: 'activity-1', campaignId: null, cattleId: 'cattle-1', title: 'Vaccinate', scheduledAt: '2026-11-11T08:00:00.000Z',
};

describe('PlannedActivityFacade', () => {
  let facade: PlannedActivityFacade;
  let activities: {
    get: ReturnType<typeof vi.fn>;
    listApplications: ReturnType<typeof vi.fn>;
    listFollowUps: ReturnType<typeof vi.fn>;
    recordApplication: ReturnType<typeof vi.fn>;
    scheduleFollowUp: ReturnType<typeof vi.fn>;
    schedule: ReturnType<typeof vi.fn>;
  };
  let applications: ActivityApplication[];
  let followUps: ActivityFollowUp[];

  beforeEach(() => {
    applications = [];
    followUps = [];
    activities = {
      get: vi.fn(async () => activity),
      listApplications: vi.fn(async () => applications),
      listFollowUps: vi.fn(async () => followUps),
      recordApplication: vi.fn(async (_ranchId: string, activityId: string, request: { cattleId: string; appliedAt: string; interventionId: string | null }) => {
        const saved = { id: 'application-1', activityId, ...request };
        applications = [...applications, saved];
        return saved;
      }),
      scheduleFollowUp: vi.fn(async (_ranchId: string, activityId: string, request: { dueAt: string }) => {
        const saved = { id: 'follow-up-1', activityId, dueAt: request.dueAt };
        followUps = [...followUps, saved];
        return saved;
      }),
      schedule: vi.fn(async () => activity),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PlannedActivityFacade, { provide: PlannedActivityRepository, useValue: activities }],
    });
    facade = TestBed.inject(PlannedActivityFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens an activity with its applications and follow-ups', async () => {
    await facade.open('ranch-1', 'activity-1');

    expect(facade.activity()).toEqual(activity);
    expect(facade.applications()).toEqual([]);
    expect(facade.followUps()).toEqual([]);
    expect(facade.loading()).toBe(false);
  });

  it('records an application of the open activity and reloads the applications', async () => {
    await facade.open('ranch-1', 'activity-1');

    await facade.recordApplication({ cattleId: 'cattle-1', appliedAt: '2026-11-11T09:00:00.000Z', interventionId: null });

    expect(activities.recordApplication).toHaveBeenCalledWith('ranch-1', 'activity-1', {
      cattleId: 'cattle-1', appliedAt: '2026-11-11T09:00:00.000Z', interventionId: null,
    });
    expect(activities.listApplications).toHaveBeenCalledTimes(2);
    expect(facade.applications()).toHaveLength(1);
  });

  it('schedules a follow-up of the open activity and reloads the follow-ups', async () => {
    await facade.open('ranch-1', 'activity-1');

    await facade.scheduleFollowUp({ dueAt: '2026-11-20T08:00:00.000Z' });

    expect(activities.scheduleFollowUp).toHaveBeenCalledWith('ranch-1', 'activity-1', { dueAt: '2026-11-20T08:00:00.000Z' });
    expect(facade.followUps()).toEqual([{ id: 'follow-up-1', activityId: 'activity-1', dueAt: '2026-11-20T08:00:00.000Z' }]);
  });

  it('refuses to record anything before an activity is opened', async () => {
    await expect(facade.recordApplication({ cattleId: 'cattle-1', appliedAt: '2026-11-11T09:00:00.000Z', interventionId: null }))
      .rejects.toMatchObject({ code: 'configuration' });
    expect(activities.recordApplication).not.toHaveBeenCalled();
  });

  it('keeps the API error of an activity that cannot be read', async () => {
    activities.get.mockRejectedValueOnce(new ApiError(404, 'http-404', 'Activity not found.'));

    await facade.open('ranch-1', 'activity-1');

    expect(facade.error()).toMatchObject({ status: 404, code: 'http-404', title: 'Activity not found.' });
    expect(facade.activity()).toBeNull();
  });

  it('passes a new activity to the repository with the ranch it belongs to', async () => {
    await facade.schedule('ranch-1', { campaignId: null, cattleId: null, title: 'Move herd', scheduledAt: '2026-11-12T08:00:00.000Z' });

    expect(activities.schedule).toHaveBeenCalledWith('ranch-1', {
      campaignId: null, cattleId: null, title: 'Move herd', scheduledAt: '2026-11-12T08:00:00.000Z',
    });
  });
});
