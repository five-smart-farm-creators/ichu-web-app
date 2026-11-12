import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { LatestTelemetry, TelemetryPage, TelemetryPeriod } from '../../domain/model/telemetry.model';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the telemetry endpoints of an animal; the API reads the period as half-open instants. */
@Injectable()
export class RestTelemetryRepository extends TelemetryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override latest(ranchId: string, cattleId: string): Promise<LatestTelemetry> {
    return firstMonitoringResponse(this.http.get<LatestTelemetry>(this.telemetryUrl(ranchId, cattleId) + '/latest', {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override readings(ranchId: string, cattleId: string, period: TelemetryPeriod, page: number, pageSize: number): Promise<TelemetryPage> {
    const params = new HttpParams()
      .set('from', period.from.toISOString())
      .set('to', period.to.toISOString())
      .set('page', page)
      .set('pageSize', pageSize);
    return firstMonitoringResponse(this.http.get<TelemetryPage>(this.telemetryUrl(ranchId, cattleId), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private telemetryUrl(ranchId: string, cattleId: string): string {
    return apiEndpoint(
      this.config.apiBaseUrl,
      `ranches/${encodeURIComponent(ranchId)}/cattle/${encodeURIComponent(cattleId)}/telemetry`,
    );
  }
}
