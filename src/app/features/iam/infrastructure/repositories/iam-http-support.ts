import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { AuthError } from '../../domain/model/auth.model';
import type { IamConfig } from '../configuration/iam-config';
import type { AuthenticationRepository } from '../../domain/repositories/authentication.repository';

export const iamRequestTimeout = 15000;

export function iamEndpoint(config: IamConfig, resource: string): string {
  const baseUrl = config.apiBaseUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new AuthError('configuration', 'The IAM API base URL is not configured. Add it to runtime settings.');
  const apiRoot = baseUrl.endsWith('/api/v1') ? baseUrl : baseUrl + '/api/v1';
  return apiRoot + '/' + resource.replace(/^\/+/, '');
}

export async function iamAuthorizationHeaders(authentication: AuthenticationRepository): Promise<HttpHeaders> {
  return new HttpHeaders({ Authorization: 'Bearer ' + await authentication.idToken() });
}

export function toIamRequestError(error: unknown): AuthError {
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
