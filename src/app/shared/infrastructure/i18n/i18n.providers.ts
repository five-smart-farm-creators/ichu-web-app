import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './language.service';

/** Serves translations from public/i18n; failOnError keeps a missing file from showing raw keys. */
export function provideI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json', failOnError: true }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    LanguageService,
    provideAppInitializer(() => inject(LanguageService).initialize()),
  ]);
}
