import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { IamAccount } from '../../domain/model/auth.model';
import type { CompleteProfessionalProfile } from '../../domain/model/professional-profile.model';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';

@Injectable()
export class IamProfessionalProfileRepository extends ProfessionalProfileRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override async current(): Promise<IamAccount> {
    try {
      return await firstValueFrom(this.http.get<IamAccount>(
        apiEndpoint(this.config.apiBaseUrl, 'profiles/me'), { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      throw toApiError(error);
    }
  }

  override async complete(profile: CompleteProfessionalProfile): Promise<IamAccount> {
    try {
      return await firstValueFrom(this.http.put<IamAccount>(
        apiEndpoint(this.config.apiBaseUrl, 'profiles/me'), profile, { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
