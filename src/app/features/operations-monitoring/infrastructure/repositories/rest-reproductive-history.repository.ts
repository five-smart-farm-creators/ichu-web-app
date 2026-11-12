import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { ReproductiveHistory } from '../../domain/model/reproductive-history.model';
import { ReproductiveHistoryRepository } from '../../domain/repositories/reproductive-history.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the reproductive history endpoint, which the API derives from the operations of the animal. */
@Injectable()
export class RestReproductiveHistoryRepository extends ReproductiveHistoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override get(ranchId: string, cattleId: string): Promise<ReproductiveHistory> {
    const path = `ranches/${encodeURIComponent(ranchId)}/cattle/${encodeURIComponent(cattleId)}/reproductive-history`;
    return firstMonitoringResponse(this.http.get<ReproductiveHistory>(apiEndpoint(this.config.apiBaseUrl, path), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }
}
