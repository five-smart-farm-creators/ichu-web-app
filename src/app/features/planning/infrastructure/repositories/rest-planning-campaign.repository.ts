import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { CreatePlanningCampaign, PlanningCampaign } from '../../domain/model/planning-campaign.model';
import { PlanningCampaignRepository } from '../../domain/repositories/planning-campaign.repository';
import { firstPlanningResponse } from '../http/planning-http';

/** Calls the campaign endpoints of one ranch. */
@Injectable()
export class RestPlanningCampaignRepository extends PlanningCampaignRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly PlanningCampaign[]> {
    return firstPlanningResponse(this.http.get<readonly PlanningCampaign[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override get(ranchId: string, campaignId: string): Promise<PlanningCampaign> {
    return firstPlanningResponse(this.http.get<PlanningCampaign>(`${this.collectionUrl(ranchId)}/${encodeURIComponent(campaignId)}`, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override create(ranchId: string, request: CreatePlanningCampaign): Promise<PlanningCampaign> {
    return firstPlanningResponse(this.http.post<PlanningCampaign>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/planning-campaigns`);
  }
}
