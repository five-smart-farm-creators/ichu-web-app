import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthError, type AuthSession, type IamAccount, type RanchAccess, type RegisterAccountRequest } from '../../domain/model/auth.model';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { IAM_CONFIG } from '../configuration/iam-config';
import { FirebaseAuthRepository } from './firebase-auth.repository';

@Injectable()
export class IamAccountRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(IAM_CONFIG);
  private readonly authentication = inject(FirebaseAuthRepository);

  override isConfigured(): boolean {
    return Boolean(this.config.apiBaseUrl.trim());
  }

  override async createSession(email: string, password: string): Promise<AuthSession> {
    try {
      const session = await firstValueFrom(this.http.post<AuthSession>(
        this.endpoint('accounts/sessions'), { email, password },
      ));
      if (!session?.idToken || typeof session.tokenType !== 'string' || session.tokenType.toLowerCase() !== 'bearer') {
        throw new AuthError('service-unavailable', 'The account service returned an invalid sign-in response.');
      }
      return session;
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async registerAccount(request: RegisterAccountRequest): Promise<void> {
    const headers = await this.authorizationHeaders();
    try {
      await firstValueFrom(this.http.post<unknown>(this.endpoint('accounts'), request, { headers }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        throw new AuthError('account-unavailable', 'An ICHU account already exists for this email. Sign in instead.');
      }
      throw this.toAuthError(error);
    }
  }

  override async currentAccount(): Promise<IamAccount> {
    const headers = await this.authorizationHeaders();
    try {
      return await firstValueFrom(this.http.get<IamAccount>(this.endpoint('accounts/me'), { headers }));
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async ranchAccess(): Promise<readonly RanchAccess[]> {
    const headers = await this.authorizationHeaders();
    try {
      return await firstValueFrom(this.http.get<readonly RanchAccess[]>(this.endpoint('accounts/me/ranches'), { headers }));
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  private async authorizationHeaders(): Promise<HttpHeaders> {
    return new HttpHeaders({ Authorization: 'Bearer ' + await this.authentication.idToken() });
  }

  private endpoint(resource: string): string {
    const baseUrl = this.config.apiBaseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new AuthError('configuration', 'The IAM API base URL is not configured. Add it to runtime settings.');
    }
    const apiRoot = baseUrl.endsWith('/api/v1') ? baseUrl : baseUrl + '/api/v1';
    return apiRoot + '/' + resource.replace(/^\/+/, '');
  }

  private toAuthError(error: unknown): AuthError {
    if (error instanceof AuthError) return error;
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return new AuthError('network', 'The IAM API could not be reached. Check your connection and try again.');
      if (error.status === 401 || error.status === 403 || error.status === 409) {
        return new AuthError('invalid-credentials', 'Access could not be granted. Check your details or contact your administrator.');
      }
      if (error.status === 503 || error.status >= 500) {
        return new AuthError('service-unavailable', 'The IAM service is temporarily unavailable. Try again later.');
      }
      if (error.status === 404) return new AuthError('account-unavailable', 'No active ICHU account is available for this identity.');
    }
    return new AuthError('unknown', 'The IAM request could not be completed. Try again.');
  }
}
