import { inject, Provider } from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { formatLocaleTag } from '../infrastructure/i18n/language';
import { LanguageService } from '../infrastructure/i18n/language.service';

/** Date pickers follow the interface language; declare these on a dialog so each opening reads the current language. */
export function provideLocalizedDateAdapter(): Provider[] {
  return [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useFactory: () => formatLocaleTag(inject(LanguageService).current()) },
  ];
}
