import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { AuthError, type IamAccount, type RanchAccess, type RegisterAccountRequest } from '../../domain/model/auth.model';
import { AccountRepository } from '../../domain/repositories/account.repository';

interface RanchAccessResponse {
  readonly ranchId: string;
  readonly scope: string;
  readonly expiresAt?: string | null;
  readonly name?: string | null;
}

@Injectable()
export class IamAccountRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override isConfigured(): boolean {
    return Boolean(this.config.apiBaseUrl.trim());
  }

  override async registerAccount(request: RegisterAccountRequest): Promise<void> {
    try {
      await firstValueFrom(this.http.post<unknown>(
        apiEndpoint(this.config.apiBaseUrl, 'accounts'), request, { timeout: API_REQUEST_TIMEOUT_MS },
      ));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) throw new AuthError('account-unavailable');
      throw this.toAccountError(error);
    }
  }

  override currentAccount(): Promise<IamAccount> {
    return this.get<IamAccount>('accounts/me');
  }

  override async ranchAccess(): Promise<readonly RanchAccess[]> {
    const response = await this.get<readonly RanchAccessResponse[]>('accounts/me/ranches');
    return response.map(item => ({
      ranchId: item.ranchId,
      scope: item.scope,
      expiresAt: item.expiresAt ?? null,
      name: item.name?.trim() || null,
    }));
  }

  private async get<T>(path: string): Promise<T> {
    try {
      return await firstValueFrom(this.http.get<T>(apiEndpoint(this.config.apiBaseUrl, path), { timeout: API_REQUEST_TIMEOUT_MS }));
    } catch (error) {
      throw this.toAccountError(error);
    }
  }

  /** A 401 means the Firebase identity has no usable ICHU account yet; other failures keep their HTTP detail. */
  private toAccountError(error: unknown): AuthError | ApiError {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return new AuthError(toApiError(error).code === 'email-not-verified' ? 'email-not-verified' : 'account-unavailable');
    }
    return toApiError(error);
  }
}
