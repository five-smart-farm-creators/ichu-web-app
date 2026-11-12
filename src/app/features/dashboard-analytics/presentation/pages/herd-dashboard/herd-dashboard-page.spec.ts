import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade } from '../../../../planning/application/acl/planning-context.facade';
import type { HerdIndicators, IndicatorValue } from '../../../domain/model/herd-indicators.model';
import { HerdIndicatorRepository } from '../../../domain/repositories/herd-indicator.repository';
import { HerdDashboardPage } from './herd-dashboard-page';

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

function indicator(overrides: Partial<IndicatorValue>): IndicatorValue {
  return { value: 12, unit: 'animals', formula: 'distinct animals with valid period readings', denominator: 14, unavailableReason: null, ...overrides };
}

/** Births and pregnancies are unobserved, and open alerts are unavailable, so the page must not show zeros for them. */
const report: HerdIndicators = {
  ranchId: 'ranch-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' }, updatedAt: '2026-11-12T00:00:00Z',
  source: 'ichu-platform', monitoredAnimals: indicator({}), openAlertsByType: null,
  alertsUnavailableReason: 'The alert snapshot is incomplete.',
  outsideGeofenceAnimals: indicator({ value: 1, denominator: null }),
  mortalityRate: indicator({ value: 0, unit: 'percent', formula: '100 * deaths during period / animals at risk during period', denominator: 14 }),
  births: indicator({ value: null, unit: 'events', formula: 'recorded births during the period', denominator: null, unavailableReason: 'Birth observations are unavailable.' }),
  confirmedPregnancies: indicator({
    value: null, unit: 'events', formula: 'confirmed pregnancies during the period', denominator: null,
    unavailableReason: 'Pregnancy observations are unavailable.',
  }),
  excludedAnimals: 2, missingReadings: null, readingsCoverageReason: 'The expected reading count is unavailable.',
};

describe('HerdDashboardPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HerdDashboardPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        {
          provide: IamContextFacade,
          useValue: { currentRanchId: signal('ranch-1'), currentRanch: signal(null), ranches: signal([]), currentRole: signal(null) },
        },
        { provide: HerdIndicatorRepository, useValue: { dashboard: vi.fn(async () => report) } },
        { provide: PlanningContextFacade, useValue: { upcomingActivities: vi.fn(async () => []) } },
        { provide: CattleInformationContextFacade, useValue: { cattleSummaries: vi.fn(async () => []) } },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows "Not available" with the API reason for every indicator the API could not observe', async () => {
    const fixture = TestBed.createComponent(HerdDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent.replace(/\s+/g, ' ');

    expect(text).toContain('Birth records are not available.');
    expect(text).toContain('Confirmed pregnancies are not recorded yet.');
    expect(text).toContain('The alert data is incomplete.');
    expect(text).toContain('The number of missing readings is not available.');
  });

  it('keeps a real zero as zero and reads the monitored animals from the report', async () => {
    const fixture = TestBed.createComponent(HerdDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const tiles: string[] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.indicator-tile .stat-value'))
      .map(element => element.textContent.replace(/\s+/g, ' ').trim());

    expect(tiles).toEqual(['12 animals', '1 animals', '0 %', 'Not available', 'Not available']);
  });

  it('never renders the ranch identifier', async () => {
    const fixture = TestBed.createComponent(HerdDashboardPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('ranch-1');
  });
});
