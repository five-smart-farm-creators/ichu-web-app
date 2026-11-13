import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { isApiRequestUrl } from '../../../../shared/infrastructure/http/api-endpoint';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';

/** Attaches the Firebase ID token to ICHU API calls, so other contexts never handle credentials. */
export const iamAuthorizationInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequestUrl(request.url, inject(RUNTIME_CONFIG).apiBaseUrl) || request.headers.has('Authorization')) {
    return next(request);
  }
  const authentication = inject(AuthenticationRepository);
  if (!authentication.currentUser()) return next(request);
  return from(authentication.idToken()).pipe(
    switchMap(token => next(request.clone({ setHeaders: { Authorization: 'Bearer ' + token } }))),
  );
};
