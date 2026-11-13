import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { AcknowledgeAlert, Alert, AlertFilter, AlertPage } from '../../domain/model/alert.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the alert endpoints of a ranch; acknowledgements send the version the screen last read. */
@Injectable()
export class RestAlertRepository extends AlertRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string, filter: AlertFilter, page: number, pageSize: number): Promise<AlertPage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.cattleId) params = params.set('cattleId', filter.cattleId);
    return firstMonitoringResponse(this.http.get<AlertPage>(this.collectionUrl(ranchId), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  /** The API answers 409 with the stored alert when the version is stale or the operation differs; both mean the screen must reload. */
  override async acknowledge(ranchId: string, alertId: string, request: AcknowledgeAlert): Promise<Alert> {
    const body = {
      status: 'Acknowledged',
      finding: request.finding,
      action: request.action,
      operationId: request.operationId,
      expectedVersion: request.expectedVersion,
    };
    try {
      return await firstMonitoringResponse(this.http.patch<Alert>(`${this.collectionUrl(ranchId)}/${encodeURIComponent(alertId)}`, body, {
        timeout: API_REQUEST_TIMEOUT_MS,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) throw new ApiError(409, VERSION_CONFLICT, null);
      throw error;
    }
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/alerts`);
  }
}
