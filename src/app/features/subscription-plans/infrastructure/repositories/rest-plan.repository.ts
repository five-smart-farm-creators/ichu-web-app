import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { Plan, PlanQuote } from '../../domain/model/plan.model';
import { PlanRepository } from '../../domain/repositories/plan.repository';
import { firstSubscriptionPlansResponse } from '../http/subscription-plans-http';

/** Calls the public plan catalog and quote endpoints; comparing plans needs no account. */
@Injectable()
export class RestPlanRepository extends PlanRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(): Promise<readonly Plan[]> {
    return firstSubscriptionPlansResponse(this.http.get<readonly Plan[]>(apiEndpoint(this.config.apiBaseUrl, 'plans'), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override quote(planId: string, headCount: number): Promise<PlanQuote> {
    return firstSubscriptionPlansResponse(this.http.get<PlanQuote>(
      apiEndpoint(this.config.apiBaseUrl, `plans/${encodeURIComponent(planId)}/quote`),
      { params: { headCount: String(headCount) }, timeout: API_REQUEST_TIMEOUT_MS },
    ));
  }
}
