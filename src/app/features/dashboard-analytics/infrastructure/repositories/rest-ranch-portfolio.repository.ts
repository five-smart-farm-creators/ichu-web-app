import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { RanchPortfolioEntry } from '../../domain/model/ranch-portfolio.model';
import { RanchPortfolioRepository } from '../../domain/repositories/ranch-portfolio.repository';
import { firstAnalyticsResponse } from '../http/analytics-http';

/** Calls the portfolio endpoint, which covers the ranches the signed-in account can access. */
@Injectable()
export class RestRanchPortfolioRepository extends RanchPortfolioRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(): Promise<readonly RanchPortfolioEntry[]> {
    return firstAnalyticsResponse(this.http.get<readonly RanchPortfolioEntry[]>(
      apiEndpoint(this.config.apiBaseUrl, 'analytics/portfolio'),
      { timeout: API_REQUEST_TIMEOUT_MS },
    ));
  }
}
