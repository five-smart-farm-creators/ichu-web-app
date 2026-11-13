import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { RanchSummary } from '../../domain/model/ranch-summary.model';
import { RanchDirectoryRepository } from '../../domain/repositories/ranch-directory.repository';

interface RanchSummaryResponse {
  readonly ranchId: string;
  readonly name?: string | null;
  readonly region?: string | null;
  readonly district?: string | null;
}

@Injectable()
export class IamRanchDirectoryRepository extends RanchDirectoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override async findByAccessCode(code: string): Promise<RanchSummary | null> {
    const params = new HttpParams().set('accessCode', code.trim().toUpperCase());
    try {
      const response = await firstValueFrom(this.http.get<RanchSummaryResponse>(
        apiEndpoint(this.config.apiBaseUrl, 'ranches'), { params, timeout: API_REQUEST_TIMEOUT_MS },
      ));
      return {
        ranchId: response.ranchId,
        name: response.name?.trim() || null,
        region: response.region?.trim() || null,
        district: response.district?.trim() || null,
      };
    } catch (error) {
      // An unknown or malformed code is an ordinary answer, so it is not reported as a failure.
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw toApiError(error);
    }
  }
}
