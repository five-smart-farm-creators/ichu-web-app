import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { NutritionPlan, RegisterNutritionPlan } from '../../domain/model/nutrition-plan.model';
import { NutritionPlanRepository } from '../../domain/repositories/nutrition-plan.repository';
import { firstPlanningResponse } from '../http/planning-http';

/** The API answers 404 with this code when no plan covers the day, which is an answer here rather than a failure. */
const NO_CURRENT_PLAN_CODE = 'Planning.NoCurrentNutritionPlan';

/** Calls the nutrition plan endpoints of one lot. */
@Injectable()
export class RestNutritionPlanRepository extends NutritionPlanRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string, lotId: string): Promise<readonly NutritionPlan[]> {
    return firstPlanningResponse(this.http.get<readonly NutritionPlan[]>(this.plansUrl(ranchId, lotId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override current(ranchId: string, lotId: string): Promise<NutritionPlan | null> {
    return firstPlanningResponse(this.http.get<NutritionPlan>(`${this.plansUrl(ranchId, lotId)}/current`, {
      timeout: API_REQUEST_TIMEOUT_MS,
    })).catch((error: unknown) => {
      if (error instanceof ApiError && error.code === NO_CURRENT_PLAN_CODE) return null;
      throw error;
    });
  }

  override register(ranchId: string, lotId: string, request: RegisterNutritionPlan): Promise<NutritionPlan> {
    return firstPlanningResponse(this.http.post<NutritionPlan>(this.plansUrl(ranchId, lotId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private plansUrl(ranchId: string, lotId: string): string {
    const path = `ranches/${encodeURIComponent(ranchId)}/lots/${encodeURIComponent(lotId)}/nutrition-plans`;
    return apiEndpoint(this.config.apiBaseUrl, path);
  }
}
