import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { ConfigureThreshold, MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the threshold endpoints of a ranch; configuring a stage and metric replaces its previous band. */
@Injectable()
export class RestMonitoringThresholdRepository extends MonitoringThresholdRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly MonitoringThreshold[]> {
    return firstMonitoringResponse(this.http.get<readonly MonitoringThreshold[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override configure(ranchId: string, request: ConfigureThreshold): Promise<MonitoringThreshold> {
    return firstMonitoringResponse(this.http.put<MonitoringThreshold>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/monitoring-thresholds`);
  }
}
