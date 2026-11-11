import { registerLocaleData } from '@angular/common';
import localeEs419 from '@angular/common/locales/es-419';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../infrastructure/i18n/language.service';
import { LocalizedDatePipe } from './localized-date.pipe';

describe('LocalizedDatePipe', () => {
  let language: LanguageService;
  let pipe: LocalizedDatePipe;

  beforeAll(() => {
    registerLocaleData(localeEs419);
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of({}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
      ],
    });
    language = TestBed.inject(LanguageService);
    pipe = TestBed.runInInjectionContext(() => new LocalizedDatePipe());
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('formats dates for US English by default', () => {
    expect(pipe.transform(new Date(2027, 0, 31))).toBe('Jan 31, 2027');
  });

  it('formats dates for Latin American Spanish once that language is selected', async () => {
    await language.use('es');

    expect(pipe.transform(new Date(2027, 0, 31))).toBe('31 ene 2027');
  });

  it('renders nothing for a missing date', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
