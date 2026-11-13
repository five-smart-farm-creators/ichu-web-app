import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { toApiError } from '../../../../shared/infrastructure/http/api-error';
import type {
  DecideHerdAdvisory, HerdAdvisoryRecord, RequestHerdAdvisory,
} from '../../domain/model/herd-advisory.model';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';

@Injectable()
export class IamHerdAdvisoryRepository extends HerdAdvisoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override async list(ranchId: string): Promise<readonly HerdAdvisoryRecord[]> {
    try {
      return await firstValueFrom(this.http.get<readonly HerdAdvisoryRecord[]>(
        this.advisoriesUrl(ranchId), { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      throw toApiError(error);
    }
  }

  override async request(ranchId: string, advisory: RequestHerdAdvisory): Promise<HerdAdvisoryRecord> {
    try {
      return await firstValueFrom(this.http.post<HerdAdvisoryRecord>(
        this.advisoriesUrl(ranchId), advisory, { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      throw toApiError(error);
    }
  }

  override async decide(ranchId: string, id: string, decision: DecideHerdAdvisory): Promise<HerdAdvisoryRecord> {
    try {
      return await firstValueFrom(this.http.patch<HerdAdvisoryRecord>(
        this.advisoriesUrl(ranchId) + '/' + encodeURIComponent(id), decision, { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      throw toApiError(error);
    }
  }

  private advisoriesUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/herd-advisories`);
  }
}
