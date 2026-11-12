import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type {
  ActivityApplication, ActivityFollowUp, PlannedActivity, RecordApplication, ScheduleActivity, ScheduleFollowUp,
} from '../../domain/model/planned-activity.model';
import type { PlanningPeriod } from '../../domain/model/planning-calendar';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { firstPlanningResponse } from '../http/planning-http';

/** Calls the calendar and activity endpoints of one ranch; the calendar reads inclusive UTC instants. */
@Injectable()
export class RestPlannedActivityRepository extends PlannedActivityRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override calendar(ranchId: string, period: PlanningPeriod): Promise<readonly PlannedActivity[]> {
    const params = new HttpParams()
      .set('from', period.from.toISOString())
      .set('to', period.to.toISOString());
    return firstPlanningResponse(this.http.get<readonly PlannedActivity[]>(this.apiUrl(`ranches/${enc(ranchId)}/calendar`), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override get(ranchId: string, activityId: string): Promise<PlannedActivity> {
    return firstPlanningResponse(this.http.get<PlannedActivity>(this.activityUrl(ranchId, activityId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override schedule(ranchId: string, request: ScheduleActivity): Promise<PlannedActivity> {
    return firstPlanningResponse(this.http.post<PlannedActivity>(this.apiUrl(`ranches/${enc(ranchId)}/planned-activities`), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override listApplications(ranchId: string, activityId: string): Promise<readonly ActivityApplication[]> {
    return firstPlanningResponse(this.http.get<readonly ActivityApplication[]>(this.activityUrl(ranchId, activityId, 'applications'), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override recordApplication(ranchId: string, activityId: string, request: RecordApplication): Promise<ActivityApplication> {
    return firstPlanningResponse(this.http.post<ActivityApplication>(this.activityUrl(ranchId, activityId, 'applications'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override listFollowUps(ranchId: string, activityId: string): Promise<readonly ActivityFollowUp[]> {
    return firstPlanningResponse(this.http.get<readonly ActivityFollowUp[]>(this.activityUrl(ranchId, activityId, 'follow-ups'), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override scheduleFollowUp(ranchId: string, activityId: string, request: ScheduleFollowUp): Promise<ActivityFollowUp> {
    return firstPlanningResponse(this.http.post<ActivityFollowUp>(this.activityUrl(ranchId, activityId, 'follow-ups'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private activityUrl(ranchId: string, activityId: string, suffix = ''): string {
    const base = this.apiUrl(`ranches/${enc(ranchId)}/planned-activities/${enc(activityId)}`);
    return suffix ? `${base}/${suffix}` : base;
  }

  private apiUrl(path: string): string {
    return apiEndpoint(this.config.apiBaseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}
