import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from './language.service';

const translations: Record<string, object> = {
  en: { meta: { description: 'English description' } },
  es: { meta: { description: 'Descripción en español' } },
};

const storageKey = 'ichu.language';

describe('LanguageService', () => {
  let language: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(translations[lang] ?? {}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
      ],
    });
    language = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('defaults to English without a saved choice', async () => {
    await language.initialize();

    expect(language.current()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('English description');
  });

  it('persists a chosen language and sets the Latin American Spanish document tag', async () => {
    await language.use('es');

    expect(language.current()).toBe('es');
    expect(localStorage.getItem(storageKey)).toBe('es');
    expect(document.documentElement.lang).toBe('es-419');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Descripción en español');
  });

  it('restores the saved language on startup', async () => {
    localStorage.setItem(storageKey, 'es');

    await language.initialize();

    expect(language.current()).toBe('es');
    expect(document.documentElement.lang).toBe('es-419');
  });

  it('keeps switching languages when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });

    await expect(language.initialize()).resolves.toBeUndefined();
    await language.use('es');

    expect(language.current()).toBe('es');
    expect(document.documentElement.lang).toBe('es-419');
  });
});
