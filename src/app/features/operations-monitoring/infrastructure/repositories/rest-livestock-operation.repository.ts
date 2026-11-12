import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type {
  LivestockOperation, OperationPeriod, RecordClinicalIntervention, RecordFieldEvent,
} from '../../domain/model/livestock-operation.model';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the livestock operation endpoints; a retried registration reuses its operation ID and the API returns the stored record. */
@Injectable()
export class RestLivestockOperationRepository extends LivestockOperationRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string, cattleId: string, period: OperationPeriod): Promise<readonly LivestockOperation[]> {
    const params = new HttpParams()
      .set('from', period.from.toISOString())
      .set('to', period.to.toISOString());
    return firstMonitoringResponse(this.http.get<readonly LivestockOperation[]>(this.cattleUrl(ranchId, cattleId) + '/livestock-operations', {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override registerFieldEvent(ranchId: string, request: RecordFieldEvent): Promise<LivestockOperation> {
    return firstMonitoringResponse(this.http.post<LivestockOperation>(this.ranchUrl(ranchId) + '/field-events', request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override registerClinicalIntervention(ranchId: string, request: RecordClinicalIntervention): Promise<LivestockOperation> {
    return firstMonitoringResponse(this.http.post<LivestockOperation>(this.ranchUrl(ranchId) + '/clinical-interventions', request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private ranchUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}`);
  }

  private cattleUrl(ranchId: string, cattleId: string): string {
    return `${this.ranchUrl(ranchId)}/cattle/${encodeURIComponent(cattleId)}`;
  }
}
