import type { CreatePlanningCampaign, PlanningCampaign } from '../model/planning-campaign.model';

/** Lists, reads and creates the campaigns of one ranch. */
export abstract class PlanningCampaignRepository {
  abstract list(ranchId: string): Promise<readonly PlanningCampaign[]>;
  abstract get(ranchId: string, campaignId: string): Promise<PlanningCampaign>;
  abstract create(ranchId: string, request: CreatePlanningCampaign): Promise<PlanningCampaign>;
}
