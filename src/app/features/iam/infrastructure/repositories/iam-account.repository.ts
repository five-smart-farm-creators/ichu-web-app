import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthError, type AuthSession, type IamAccount, type RanchAccess, type RegisterAccountRequest } from '../../domain/model/auth.model';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { IAM_CONFIG } from '../configuration/iam-config';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { iamAuthorizationHeaders, iamEndpoint, iamRequestTimeout, toIamRequestError } from './iam-http-support';

@Injectable()
export class IamAccountRepository extends AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(IAM_CONFIG);
  private readonly authentication = inject(AuthenticationRepository);

  override isConfigured(): boolean {
    return Boolean(this.config.apiBaseUrl.trim());
  }

  override async createSession(email: string, password: string): Promise<AuthSession> {
    try {
      const session = await firstValueFrom(this.http.post<AuthSession>(
        iamEndpoint(this.config, 'accounts/sessions'), { email, password }, { timeout: iamRequestTimeout },
      ));
      if (!session?.idToken || typeof session.tokenType !== 'string' || session.tokenType.toLowerCase() !== 'bearer') {
        throw new AuthError('service-unavailable', 'The account service returned an invalid sign-in response.');
      }
      return session;
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async registerAccount(request: RegisterAccountRequest): Promise<void> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      await firstValueFrom(this.http.post<unknown>(iamEndpoint(this.config, 'accounts'), request, { headers, timeout: iamRequestTimeout }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        throw new AuthError('account-unavailable', 'An ICHU account already exists for this email. Sign in instead.');
      }
      throw toIamRequestError(error);
    }
  }

  override async currentAccount(): Promise<IamAccount> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.get<IamAccount>(iamEndpoint(this.config, 'accounts/me'), { headers, timeout: iamRequestTimeout }));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async ranchAccess(): Promise<readonly RanchAccess[]> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.get<readonly RanchAccess[]>(iamEndpoint(this.config, 'accounts/me/ranches'), { headers, timeout: iamRequestTimeout }));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

}
