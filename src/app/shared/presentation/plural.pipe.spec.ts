import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../infrastructure/i18n/language.service';
import { PluralPipe, pluralTranslationKey } from './plural.pipe';

const translations: Record<string, object> = {
  en: {
    demo: {
      animals: { one: '{{count}} animal', other: '{{count}} animals' },
      corners: { one: '{{count}} corner, at least {{minimum}}', other: '{{count}} corners, at least {{minimum}}' },
    },
  },
  es: {
    demo: {
      animals: { one: '{{count}} animal', other: '{{count}} animales' },
      corners: { one: '{{count}} vértice, al menos {{minimum}}', other: '{{count}} vértices, al menos {{minimum}}' },
    },
  },
};

describe('pluralTranslationKey', () => {
  it('uses the singular in English only for exactly one', () => {
    expect(pluralTranslationKey('demo.animals', 1, 'en')).toBe('demo.animals.one');
    expect(pluralTranslationKey('demo.animals', 0, 'en')).toBe('demo.animals.other');
    expect(pluralTranslationKey('demo.animals', 2, 'en')).toBe('demo.animals.other');
    expect(pluralTranslationKey('demo.animals', 1.5, 'en')).toBe('demo.animals.other');
  });

  it('uses the singular in Latin American Spanish only for exactly one', () => {
    expect(pluralTranslationKey('demo.animals', 1, 'es')).toBe('demo.animals.one');
    expect(pluralTranslationKey('demo.animals', 0, 'es')).toBe('demo.animals.other');
    expect(pluralTranslationKey('demo.animals', 2, 'es')).toBe('demo.animals.other');
  });
});

describe('PluralPipe', () => {
  let language: LanguageService;
  let pipe: PluralPipe;

  beforeEach(async () => {
    localStorage.clear();
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
    pipe = TestBed.runInInjectionContext(() => new PluralPipe());
    await language.use('en');
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('shows the singular and plural English wording', () => {
    expect(pipe.transform('demo.animals', 1)).toBe('1 animal');
    expect(pipe.transform('demo.animals', 3)).toBe('3 animals');
    expect(pipe.transform('demo.animals', 0)).toBe('0 animals');
  });

  it('passes the other parameters next to the count', () => {
    expect(pipe.transform('demo.corners', 1, { minimum: 3 })).toBe('1 corner, at least 3');
    expect(pipe.transform('demo.corners', 4, { minimum: 3 })).toBe('4 corners, at least 3');
  });

  it('shows the singular and plural Spanish wording once Spanish is selected', async () => {
    await language.use('es');

    expect(pipe.transform('demo.animals', 1)).toBe('1 animal');
    expect(pipe.transform('demo.animals', 2)).toBe('2 animales');
    expect(pipe.transform('demo.corners', 2, { minimum: 3 })).toBe('2 vértices, al menos 3');
  });
});
