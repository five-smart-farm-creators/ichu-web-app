import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { PlannedActivity } from '../../domain/model/planned-activity.model';
import type { CreatePlanningCampaign, PlanningCampaign } from '../../domain/model/planning-campaign.model';
import { endOfDay, parseLocalDay, startOfDay } from '../../domain/model/planning-time';
import { PlanningCampaignRepository } from '../../domain/repositories/planning-campaign.repository';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';

/** Lists the campaigns of one ranch and reads the activities that fall inside each of them. */
@Injectable()
export class PlanningCampaignsFacade {
  private readonly campaigns = inject(PlanningCampaignRepository);
  private readonly activities = inject(PlannedActivityRepository);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly rows = signal<readonly PlanningCampaign[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Loads the campaigns of a ranch; a null ranch clears the list. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.rows.set([]);
    this.error.set(null);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const campaigns = await this.campaigns.list(ranchId);
      if (request === this.requestId) this.rows.set(campaigns);
    } catch (error) {
      if (request === this.requestId) this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }

  /** Creates a campaign and reloads the list, so the screen shows what the API stored. */
  async create(request: CreatePlanningCampaign): Promise<PlanningCampaign> {
    const ranchId = this.ranchId;
    if (!ranchId) throw new ApiError(0, 'configuration', null);
    const campaign = await this.campaigns.create(ranchId, request);
    await this.refresh();
    return campaign;
  }

  /** Reads one campaign again so its detail shows the stored dates. */
  read(campaignId: string): Promise<PlanningCampaign> {
    const ranchId = this.ranchId;
    if (!ranchId) return Promise.reject(new ApiError(0, 'configuration', null));
    return this.campaigns.get(ranchId, campaignId);
  }

  /** The activities scheduled on the campaign's days that belong to the campaign, in schedule order. */
  async activitiesOf(campaign: PlanningCampaign): Promise<readonly PlannedActivity[]> {
    const ranchId = this.ranchId;
    if (!ranchId) return [];
    const activities = await this.activities.calendar(ranchId, {
      from: startOfDay(parseLocalDay(campaign.startsOn)),
      to: endOfDay(parseLocalDay(campaign.endsOn)),
    });
    return activities.filter(activity => activity.campaignId === campaign.id);
  }
}
