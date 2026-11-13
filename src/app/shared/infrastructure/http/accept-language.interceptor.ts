import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { acceptLanguageTag } from '../i18n/language';
import { LanguageService } from '../i18n/language.service';
import { isApiRequestUrl } from './api-endpoint';

/** Asks the ICHU API for messages in the current interface language; static files are left alone. */
export const acceptLanguageInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequestUrl(request.url, inject(RUNTIME_CONFIG).apiBaseUrl)) return next(request);
  const language = inject(LanguageService).current();
  return next(request.clone({ setHeaders: { 'Accept-Language': acceptLanguageTag(language) } }));
};
