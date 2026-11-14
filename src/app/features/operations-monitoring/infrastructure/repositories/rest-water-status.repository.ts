import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { WaterReadingPeriod, WaterReadingsPage, WaterTroughStatus } from '../../domain/model/water-status.model';
import { WaterStatusRepository } from '../../domain/repositories/water-status.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the water trough status and water controller reading endpoints of the ICHU API. */
@Injectable()
export class RestWaterStatusRepository extends WaterStatusRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override async troughStatuses(ranchId: string): Promise<readonly WaterTroughStatus[]> {
    const url = apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/water-troughs/status`);
    const response = await firstMonitoringResponse(this.http.get<{ readonly items: readonly WaterTroughStatus[] }>(url, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
    return response.items;
  }

  override readings(controllerId: string, period: WaterReadingPeriod, page: number, pageSize: number): Promise<WaterReadingsPage> {
    const params = new HttpParams()
      .set('from', microsecondIso(period.from))
      .set('to', microsecondIso(period.to))
      .set('page', page)
      .set('pageSize', pageSize);
    const url = apiEndpoint(this.config.apiBaseUrl, `water-controllers/${encodeURIComponent(controllerId)}/readings`);
    return firstMonitoringResponse(this.http.get<WaterReadingsPage>(url, { params, timeout: API_REQUEST_TIMEOUT_MS }));
  }
}

/** The API rejects periods without microsecond precision, while Date writes milliseconds, so the digits are padded. */
function microsecondIso(date: Date): string {
  return date.toISOString().replace(/Z$/, '000Z');
}
