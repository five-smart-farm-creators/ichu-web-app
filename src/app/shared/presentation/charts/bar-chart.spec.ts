import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../infrastructure/i18n/language.service';
import { BarChart } from './bar-chart';

// Chart.js needs a real canvas, which the test environment does not provide, so only its constructor is replaced.
vi.mock('chart.js/auto', () => ({
  default: vi.fn(function ChartStub() {
    return { destroy: vi.fn() };
  }),
}));

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

describe('BarChart', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BarChart],
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
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('labels', ['10 Nov', '11 Nov', '12 Nov']);
    fixture.componentRef.setInput('series', [
      { label: 'New cases', color: '--danger', kind: 'bar', values: [2, null, 4] },
      { label: 'Moving average', color: '--forest', kind: 'line', values: [null, 1, 3] },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const items = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('li')).map(item => item.textContent.trim());
    expect(items).toEqual([
      'New cases: minimum 2, maximum 4, average 3',
      'Moving average: minimum 1, maximum 3, average 2',
    ]);
    expect(fixture.nativeElement.querySelector('canvas')?.getAttribute('role')).toBe('img');
  });

  it('says that no cases exist when no series has values', async () => {
    const fixture = TestBed.createComponent(BarChart);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('li')?.textContent.trim()).toBe('No readings in this period.');
  });
});
