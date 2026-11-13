import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { type AppLanguage, formatLocaleTag } from '../infrastructure/i18n/language';
import { LanguageService } from '../infrastructure/i18n/language.service';

/** Returns the `.one` or `.other` key that the language uses for a count, since ngx-translate has no ICU plurals. */
export function pluralTranslationKey(key: string, count: number, language: AppLanguage): string {
  const category = new Intl.PluralRules(formatLocaleTag(language)).select(count);
  return `${key}.${category === 'one' ? 'one' : 'other'}`;
}

/** Translates the singular or plural form of a key for a count; impure so each render reads the current language. */
@Pipe({ name: 'plural', pure: false })
export class PluralPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  transform(key: string, count: number, params: Readonly<Record<string, unknown>> = {}): string {
    return this.translate.instant(pluralTranslationKey(key, count, this.language.current()), { count, ...params });
  }
}
