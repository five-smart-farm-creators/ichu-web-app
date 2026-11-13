import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { DownloadedFile, ExecutiveReportDocument } from '../../domain/model/executive-report.model';
import { ExecutiveReportRepository } from '../../domain/repositories/executive-report.repository';
import { firstAnalyticsResponse, periodParams } from '../http/analytics-http';

/** Calls the executive report endpoint of one ranch, as a JSON document or a CSV file. */
@Injectable()
export class RestExecutiveReportRepository extends ExecutiveReportRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override document(ranchId: string, period: AnalyticsPeriod): Promise<ExecutiveReportDocument> {
    return firstAnalyticsResponse(this.http.get<ExecutiveReportDocument>(this.reportUrl(ranchId), {
      params: periodParams(period).set('format', 'json'),
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override async csv(ranchId: string, period: AnalyticsPeriod): Promise<DownloadedFile> {
    const response = await firstAnalyticsResponse(this.http.get(this.reportUrl(ranchId), {
      params: periodParams(period).set('format', 'csv'),
      responseType: 'blob',
      observe: 'response',
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
    if (!response.body) throw new ApiError(response.status, 'unknown', null);
    return { content: response.body };
  }

  private reportUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/reports/executive`);
  }
}
