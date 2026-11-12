import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../infrastructure/i18n/language.service';
import { LineChart } from './line-chart';

// Chart.js needs a real canvas, which the test environment does not provide, so only its constructor is replaced.
vi.mock('chart.js/auto', () => ({
  default: vi.fn(function ChartStub() {
    return { destroy: vi.fn() };
  }),
}));

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

describe('LineChart', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LineChart],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('gives screen readers the minimum, maximum and average of each series, leaving out gaps', async () => {
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('series', [{
      label: 'Body temperature',
      color: '--forest',
      points: [
        { x: new Date('2026-11-10T00:00:00Z'), y: 38 },
        { x: new Date('2026-11-10T01:00:00Z'), y: 40 },
        { x: new Date('2026-11-10T02:00:00Z'), y: null },
      ],
    }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('li')).map(item => item.textContent.trim());
    expect(items).toEqual(['Body temperature: minimum 38, maximum 40, average 39']);
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('role')).toBe('img');
  });

  it('says that no readings exist when no series has points', async () => {
    const fixture = TestBed.createComponent(LineChart);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('li')?.textContent.trim()).toBe('No readings in this period.');
  });
});
