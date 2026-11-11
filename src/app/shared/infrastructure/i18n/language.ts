/** Interface languages; English is the default and no browser language is detected. */
export type AppLanguage = 'en' | 'es';

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['en', 'es'];

const HTML_LANG_TAGS: Readonly<Record<AppLanguage, string>> = { en: 'en', es: 'es-419' };
const ACCEPT_LANGUAGE_TAGS: Readonly<Record<AppLanguage, string>> = { en: 'en-US', es: 'es-419' };

/** Returns the value for the document `lang` attribute. */
export function htmlLangTag(language: AppLanguage): string {
  return HTML_LANG_TAGS[language];
}

/** Returns the value the ICHU API uses to localize its ProblemDetails titles. */
export function acceptLanguageTag(language: AppLanguage): string {
  return ACCEPT_LANGUAGE_TAGS[language];
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
