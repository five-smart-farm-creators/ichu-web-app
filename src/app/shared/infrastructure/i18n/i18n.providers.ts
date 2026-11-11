import { registerLocaleData } from '@angular/common';
import localeEs419 from '@angular/common/locales/es-419';
import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './language.service';

/** Serves translations from public/i18n; failOnError keeps a missing file from showing raw keys. */
export function provideI18n(): EnvironmentProviders {
  // Angular bundles only en-US dates, so Latin American Spanish dates need their locale data.
  registerLocaleData(localeEs419);
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
