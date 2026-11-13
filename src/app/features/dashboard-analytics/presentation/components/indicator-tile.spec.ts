import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import type { IconName } from '../../../../shared/presentation/icon';
import type { IndicatorValue } from '../../domain/model/herd-indicators.model';
import { IndicatorTile, type StatTone } from './indicator-tile';

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;
const spanishTranslations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'es.json'), 'utf8')) as Record<string, unknown>;

function render(indicator: IndicatorValue, look: { readonly tone?: StatTone; readonly icon?: IconName } = {}) {
  const fixture = TestBed.createComponent(IndicatorTile);
  fixture.componentRef.setInput('label', 'analytics.indicators.births');
  fixture.componentRef.setInput('indicator', indicator);
  if (look.tone) fixture.componentRef.setInput('tone', look.tone);
  if (look.icon) fixture.componentRef.setInput('icon', look.icon);
  fixture.detectChanges();
  return fixture;
}

describe('IndicatorTile', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [IndicatorTile],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(lang === 'es' ? spanishTranslations : translations) } },
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

  it('shows the value with its unit', () => {
    const element: HTMLElement = render({ value: 3, unit: 'events', formula: 'recorded births during the period', denominator: null, unavailableReason: null }).nativeElement;

    expect(element.querySelector('.stat-value')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 events');
  });

  it('uses the singular unit for one animal', () => {
    const element: HTMLElement = render({
      value: 1, unit: 'animals', formula: 'distinct animals with valid period readings', denominator: 14, unavailableReason: null,
    }).nativeElement;

    expect(element.querySelector('.stat-value')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 animal');
  });

  it('uses the Spanish plural once Spanish is selected', async () => {
    await TestBed.inject(LanguageService).use('es');

    const element: HTMLElement = render({
      value: 2, unit: 'events', formula: 'recorded births during the period', denominator: null, unavailableReason: null,
    }).nativeElement;

    expect(element.querySelector('.stat-value')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 eventos');
  });

  it('replaces a missing value with "Not available" and its reason, never with zero', () => {
    const element: HTMLElement = render({
      value: null, unit: 'events', formula: 'recorded births during the period', denominator: null,
      unavailableReason: 'Birth observations are unavailable.',
    }).nativeElement;

    expect(element.querySelector('.stat-value')?.textContent?.trim()).toBe('Not available');
    expect(element.querySelector('.stat-note')?.textContent?.trim()).toBe('Birth records are not available.');
    expect(element.textContent).not.toMatch(/\b0\b/);
  });

  it('reveals the calculation and its base only when asked', () => {
    const fixture = render({
      value: 5, unit: 'percent', formula: '100 * deaths during period / animals at risk during period', denominator: 40,
      unavailableReason: null,
    });
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('.formula-toggle');

    expect(element.querySelector('.formula')).toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();

    expect(element.querySelector('.formula')?.textContent).toContain('100 × deaths in the period ÷ animals at risk in the period');
    expect(element.textContent).toContain('Base of the calculation: 40');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
  });

  it('carries its tone on the card and draws its icon beside the label, hidden from screen readers', () => {
    const element: HTMLElement = render({
      value: 3, unit: 'events', formula: 'recorded births during the period', denominator: null, unavailableReason: null,
    }, { tone: 'danger', icon: 'alert' }).nativeElement;

    expect(element.querySelector('.indicator-tile')?.getAttribute('data-tone')).toBe('danger');
    expect(element.querySelector('.stat-head .stat-icon svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
