import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { AnimalComparison, TrendQuery, TrendSeries } from '../../domain/model/lot-trend.model';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { firstAnalyticsResponse, periodParams } from '../http/analytics-http';

/** Calls the lot trend and animal comparison endpoints of one ranch. */
@Injectable()
export class RestLotTrendRepository extends LotTrendRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override lotTrend(ranchId: string, query: TrendQuery): Promise<TrendSeries> {
    const url = apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/trends`);
    return firstAnalyticsResponse(this.http.get<TrendSeries>(url, { params: trendParams(query), timeout: API_REQUEST_TIMEOUT_MS }));
  }

  override animalComparison(ranchId: string, cattleId: string, query: TrendQuery): Promise<AnimalComparison> {
    const path = `ranches/${encodeURIComponent(ranchId)}/trends/cattle/${encodeURIComponent(cattleId)}/comparison`;
    return firstAnalyticsResponse(this.http.get<AnimalComparison>(apiEndpoint(this.config.apiBaseUrl, path), {
      params: trendParams(query),
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }
}

function trendParams(query: TrendQuery): HttpParams {
  return periodParams(query.period)
    .set('lotId', query.lotId)
    .set('metric', query.metric)
    .set('deviation', String(query.deviation));
}
