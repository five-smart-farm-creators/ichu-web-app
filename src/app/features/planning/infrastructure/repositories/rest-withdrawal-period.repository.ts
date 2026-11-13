import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { RecordWithdrawalPeriod, WithdrawalPeriod } from '../../domain/model/withdrawal-period.model';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';
import { firstPlanningResponse } from '../http/planning-http';

/** Calls the withdrawal period endpoints of one ranch. */
@Injectable()
export class RestWithdrawalPeriodRepository extends WithdrawalPeriodRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string, cattleId: string | null): Promise<readonly WithdrawalPeriod[]> {
    let params = new HttpParams();
    if (cattleId) params = params.set('cattleId', cattleId);
    return firstPlanningResponse(this.http.get<readonly WithdrawalPeriod[]>(this.collectionUrl(ranchId), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override record(ranchId: string, request: RecordWithdrawalPeriod): Promise<WithdrawalPeriod> {
    return firstPlanningResponse(this.http.post<WithdrawalPeriod>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/withdrawal-periods`);
  }
}
