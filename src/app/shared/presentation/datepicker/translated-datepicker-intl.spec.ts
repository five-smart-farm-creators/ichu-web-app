import { TestBed } from '@angular/core/testing';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of } from 'rxjs';
import { TranslatedDatepickerIntl } from './translated-datepicker-intl';

const translations: Record<string, object> = {
  en: {
    common: {
      datepicker: {
        calendar: 'Calendar',
        openCalendar: 'Open calendar',
        chooseDate: 'Choose date',
        yearRange: '{{start}} – {{end}}',
        yearRangeLabel: '{{start}} to {{end}}',
      },
    },
  },
  es: {
    common: {
      datepicker: {
        calendar: 'Calendario',
        openCalendar: 'Abrir calendario',
        chooseDate: 'Elegir fecha',
        yearRange: '{{start}} – {{end}}',
        yearRangeLabel: '{{start}} a {{end}}',
      },
    },
  },
};

describe('TranslatedDatepickerIntl', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(translations[lang] ?? {}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: MatDatepickerIntl, useClass: TranslatedDatepickerIntl },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels the calendar controls in the interface language', async () => {
    const translate = TestBed.inject(TranslateService);
    await firstValueFrom(translate.use('en'));
    const intl = TestBed.inject(MatDatepickerIntl);
    expect(intl.openCalendarLabel).toBe('Open calendar');
    expect(intl.switchToMonthViewLabel).toBe('Choose date');

    await firstValueFrom(translate.use('es'));
    expect(intl.openCalendarLabel).toBe('Abrir calendario');
    expect(intl.switchToMonthViewLabel).toBe('Elegir fecha');
    expect(intl.calendarLabel).toBe('Calendario');
  });

  it('announces the change so open calendars read the new labels', async () => {
    const translate = TestBed.inject(TranslateService);
    await firstValueFrom(translate.use('en'));
    const intl = TestBed.inject(MatDatepickerIntl);
    const changes = vi.fn();
    intl.changes.subscribe(changes);

    await firstValueFrom(translate.use('es'));

    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('formats the year ranges of the multi-year view in the interface language', async () => {
    const translate = TestBed.inject(TranslateService);
    await firstValueFrom(translate.use('en'));
    const intl = TestBed.inject(MatDatepickerIntl);
    expect(intl.formatYearRange('2020', '2044')).toBe('2020 – 2044');
    expect(intl.formatYearRangeLabel('2020', '2044')).toBe('2020 to 2044');

    await firstValueFrom(translate.use('es'));
    expect(intl.formatYearRangeLabel('2020', '2044')).toBe('2020 a 2044');
  });
});
