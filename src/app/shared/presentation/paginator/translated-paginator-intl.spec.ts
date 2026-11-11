import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of } from 'rxjs';
import { TranslatedPaginatorIntl } from './translated-paginator-intl';

const translations: Record<string, object> = {
  en: {
    common: {
      paginator: { itemsPerPage: 'Items per page', next: 'Next page', previous: 'Previous page', first: 'First page', last: 'Last page', range: '{{start}} – {{end}}' },
    },
  },
  es: {
    common: {
      paginator: { itemsPerPage: 'Elementos por página', next: 'Página siguiente', previous: 'Página anterior', first: 'Primera página', last: 'Última página', range: '{{start}} – {{end}}' },
    },
  },
};

describe('TranslatedPaginatorIntl', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(translations[lang] ?? {}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels the visible range without a total, because server-paged lists do not report one', async () => {
    await firstValueFrom(TestBed.inject(TranslateService).use('en'));
    const intl = TestBed.inject(MatPaginatorIntl);

    expect(intl.getRangeLabel(0, 25, 26)).toBe('1 – 25');
    expect(intl.getRangeLabel(1, 25, 30)).toBe('26 – 30');
    expect(intl.getRangeLabel(0, 25, 0)).toBe('0');
  });

  it('switches the control labels with the interface language', async () => {
    const translate = TestBed.inject(TranslateService);
    await firstValueFrom(translate.use('en'));
    const intl = TestBed.inject(MatPaginatorIntl);
    expect(intl.nextPageLabel).toBe('Next page');

    await firstValueFrom(translate.use('es'));
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.itemsPerPageLabel).toBe('Elementos por página');
  });
});
