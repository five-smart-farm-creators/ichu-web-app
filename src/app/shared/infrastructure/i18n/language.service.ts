import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { type AppLanguage, DEFAULT_LANGUAGE, htmlLangTag, isAppLanguage } from './language';

const LANGUAGE_STORAGE_KEY = 'ichu.language';

/** Switches the interface language and keeps the document language and description in step. */
@Injectable()
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  readonly current = signal<AppLanguage>(DEFAULT_LANGUAGE);

  /** Loads the saved language before the first render; if it cannot load, English is used. */
  async initialize(): Promise<void> {
    await this.use(readStoredLanguage() ?? DEFAULT_LANGUAGE)
      .catch(() => this.use(DEFAULT_LANGUAGE))
      .catch(() => undefined);
  }

  /** Loads translations before switching so no screen shows raw keys for a half-loaded language. */
  async use(language: AppLanguage): Promise<void> {
    await firstValueFrom(this.translate.use(language));
    this.current.set(language);
    writeStoredLanguage(language);
    this.document.documentElement.lang = htmlLangTag(language);
    this.meta.updateTag({ name: 'description', content: this.translate.instant('meta.description') });
  }
}

function readStoredLanguage(): AppLanguage | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be disabled; the language still applies until the page reloads.
  }
}
