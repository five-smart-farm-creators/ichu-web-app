import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { TranslatedTitleStrategy } from './core/layout/translated-title.strategy';
import { RUNTIME_CONFIG, RuntimeConfig } from './core/config/runtime-config';
import { provideCattleInformation } from './features/cattle-information/infrastructure/configuration/cattle-information.providers';
import { provideIam } from './features/iam/infrastructure/configuration/iam.providers';
import { iamAuthorizationInterceptor } from './features/iam/infrastructure/http/iam-authorization.interceptor';
import { provideI18n } from './shared/infrastructure/i18n/i18n.providers';
import { acceptLanguageInterceptor } from './shared/infrastructure/http/accept-language.interceptor';

export function createAppConfig(config: RuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: RUNTIME_CONFIG, useValue: config },
      provideRouter(routes),
      { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      provideHttpClient(withInterceptors([acceptLanguageInterceptor, iamAuthorizationInterceptor])),
      provideI18n(),
      provideIam(),
      provideCattleInformation(),
    ],
  };
}
