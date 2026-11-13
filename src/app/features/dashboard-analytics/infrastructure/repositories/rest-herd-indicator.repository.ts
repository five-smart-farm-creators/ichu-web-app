import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { HerdIndicators } from '../../domain/model/herd-indicators.model';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { firstAnalyticsResponse, periodParams } from '../http/analytics-http';

/** Calls the herd dashboard endpoint of one ranch. */
@Injectable()
export class RestHerdIndicatorRepository extends HerdIndicatorRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override dashboard(ranchId: string, period: AnalyticsPeriod): Promise<HerdIndicators> {
    const url = apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/dashboard`);
    return firstAnalyticsResponse(this.http.get<HerdIndicators>(url, { params: periodParams(period), timeout: API_REQUEST_TIMEOUT_MS }));
  }
}
