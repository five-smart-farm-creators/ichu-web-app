import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type {
  ConfigureTemperatureRange, RegisterWaterTrough, WaterTrough,
} from '../../domain/model/water-trough.model';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';
import { firstIotAssetsResponse } from '../http/iot-assets-http';

/** Calls the water trough endpoints of the ICHU API; every URL is scoped to the ranch. */
@Injectable()
export class RestWaterTroughRepository extends WaterTroughRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly WaterTrough[]> {
    return firstIotAssetsResponse(this.http.get<readonly WaterTrough[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override register(ranchId: string, request: RegisterWaterTrough): Promise<WaterTrough> {
    return firstIotAssetsResponse(this.http.post<WaterTrough>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override configureTemperatureRange(
    ranchId: string,
    waterTroughId: string,
    request: ConfigureTemperatureRange,
  ): Promise<WaterTrough> {
    const url = `${this.collectionUrl(ranchId)}/${encodeURIComponent(waterTroughId)}/temperature-range`;
    return firstIotAssetsResponse(this.http.put<WaterTrough>(url, request, { timeout: API_REQUEST_TIMEOUT_MS }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/water-troughs`);
  }
}
