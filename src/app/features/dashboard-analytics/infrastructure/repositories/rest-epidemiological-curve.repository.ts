import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { EpidemiologicalCurve } from '../../domain/model/epidemiological-curve.model';
import { EpidemiologicalCurveRepository } from '../../domain/repositories/epidemiological-curve.repository';
import { firstAnalyticsResponse, periodParams } from '../http/analytics-http';

/** Calls the epidemiological curve endpoint of one ranch. */
@Injectable()
export class RestEpidemiologicalCurveRepository extends EpidemiologicalCurveRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override curve(ranchId: string, period: AnalyticsPeriod, condition: string): Promise<EpidemiologicalCurve> {
    const url = apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/epidemiological-curves`);
    return firstAnalyticsResponse(this.http.get<EpidemiologicalCurve>(url, {
      params: periodParams(period).set('condition', condition),
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }
}
