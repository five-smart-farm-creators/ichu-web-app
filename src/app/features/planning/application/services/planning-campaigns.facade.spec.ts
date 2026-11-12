import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { PlannedActivity } from '../../domain/model/planned-activity.model';
import type { CreatePlanningCampaign, PlanningCampaign } from '../../domain/model/planning-campaign.model';
import { PlanningCampaignRepository } from '../../domain/repositories/planning-campaign.repository';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { PlanningCampaignsFacade } from './planning-campaigns.facade';

function campaign(id: string): PlanningCampaign {
  return { id, name: 'Campaign ' + id, kind: 'Sanitary', startsOn: '2026-11-10', endsOn: '2026-11-12' };
}

function activity(id: string, campaignId: string | null): PlannedActivity {
  return { id, campaignId, cattleId: null, title: 'Activity ' + id, scheduledAt: '2026-11-11T08:00:00.000Z' };
}

describe('PlanningCampaignsFacade', () => {
  let facade: PlanningCampaignsFacade;
  let campaigns: { list: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let activities: { calendar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    campaigns = {
      list: vi.fn(async () => [campaign('campaign-1')]),
      get: vi.fn(async () => campaign('campaign-1')),
      create: vi.fn(async (_ranchId: string, request: CreatePlanningCampaign) => ({ id: 'campaign-2', ...request, name: request.name })),
    };
    activities = {
      calendar: vi.fn(async () => [activity('a-1', 'campaign-1'), activity('a-2', null), activity('a-3', 'campaign-2')]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlanningCampaignsFacade,
        { provide: PlanningCampaignRepository, useValue: campaigns },
        { provide: PlannedActivityRepository, useValue: activities },
      ],
    });
    facade = TestBed.inject(PlanningCampaignsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the campaigns of the ranch', async () => {
    await facade.open('ranch-1');

    expect(campaigns.list).toHaveBeenCalledWith('ranch-1');
    expect(facade.rows()).toEqual([campaign('campaign-1')]);
  });

  it('creates a campaign and reloads the list so it shows what the API stored', async () => {
    await facade.open('ranch-1');
    const request: CreatePlanningCampaign = { name: 'Spring', kind: 'Reproductive', startsOn: '2026-11-10', endsOn: '2026-11-12' };

    await facade.create(request);

    expect(campaigns.create).toHaveBeenCalledWith('ranch-1', request);
    expect(campaigns.list).toHaveBeenCalledTimes(2);
  });

  it('reads the activities scheduled on the campaign days that belong to the campaign', async () => {
    await facade.open('ranch-1');

    const found = await facade.activitiesOf(campaign('campaign-1'));

    expect(activities.calendar).toHaveBeenCalledWith('ranch-1', {
      from: new Date(2026, 10, 10),
      to: new Date(2026, 10, 12, 23, 59, 59, 999),
    });
    expect(found.map(item => item.id)).toEqual(['a-1']);
  });

  it('refuses to create a campaign when no ranch is open', async () => {
    await facade.open(null);

    await expect(facade.create({ name: 'Spring', kind: 'Sanitary', startsOn: '2026-11-10', endsOn: '2026-11-12' }))
      .rejects.toMatchObject({ code: 'configuration' });
    expect(campaigns.list).not.toHaveBeenCalled();
  });

  it('keeps the error of a failed listing for the screen', async () => {
    campaigns.list.mockRejectedValueOnce(new ApiError(0, 'network', null));

    await facade.open('ranch-1');

    expect(facade.error()?.code).toBe('network');
    expect(facade.rows()).toEqual([]);
  });
});
