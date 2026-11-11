import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../shared/infrastructure/i18n/language.service';
import { TranslatedTitleStrategy } from './translated-title.strategy';

const translations: Record<string, object> = {
  en: { pages: { signIn: 'Sign in' } },
  es: { pages: { signIn: 'Iniciar sesión' } },
};

describe('TranslatedTitleStrategy', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', title: 'pages.signIn', children: [] }]),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(translations[lang] ?? {}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('titles the page in the active language and follows a language switch', async () => {
    await TestBed.inject(LanguageService).initialize();
    await TestBed.inject(Router).navigateByUrl('/login');
    expect(document.title).toBe('Sign in · ICHU');

    await TestBed.inject(LanguageService).use('es');
    expect(document.title).toBe('Iniciar sesión · ICHU');
  });
});
