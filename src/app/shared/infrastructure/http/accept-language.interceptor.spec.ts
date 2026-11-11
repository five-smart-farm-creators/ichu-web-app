import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { LanguageService } from '../i18n/language.service';
import { acceptLanguageInterceptor } from './accept-language.interceptor';

const apiUrl = 'https://api.example.test/api/v1/accounts/me';

describe('acceptLanguageInterceptor', () => {
  let http: HttpClient;
  let testing: HttpTestingController;
  let language: LanguageService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
        provideHttpClientTesting(),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of({}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpClient);
    testing = TestBed.inject(HttpTestingController);
    language = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    try { testing.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('asks the ICHU API for en-US messages by default', () => {
    http.get(apiUrl).subscribe();
    const request = testing.expectOne(apiUrl);

    expect(request.request.headers.get('Accept-Language')).toBe('en-US');
    request.flush({});
  });

  it('asks the ICHU API for es-419 messages after the language changes', async () => {
    await language.use('es');
    http.get(apiUrl).subscribe();
    const request = testing.expectOne(apiUrl);

    expect(request.request.headers.get('Accept-Language')).toBe('es-419');
    request.flush({});
  });

  it('leaves static translation files without an Accept-Language header', () => {
    http.get('/i18n/en.json').subscribe();
    const request = testing.expectOne('/i18n/en.json');

    expect(request.request.headers.has('Accept-Language')).toBe(false);
    request.flush({});
  });
});
