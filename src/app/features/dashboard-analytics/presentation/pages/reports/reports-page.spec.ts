import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import type { EpidemiologicalCurve } from '../../../domain/model/epidemiological-curve.model';
import type { ExecutiveReportDocument } from '../../../domain/model/executive-report.model';
import type { HerdIndicators } from '../../../domain/model/herd-indicators.model';
import type { AnimalComparison, TrendSeries } from '../../../domain/model/lot-trend.model';
import { EpidemiologicalCurveRepository } from '../../../domain/repositories/epidemiological-curve.repository';
import { ExecutiveReportRepository } from '../../../domain/repositories/executive-report.repository';
import { HerdIndicatorRepository } from '../../../domain/repositories/herd-indicator.repository';
import { LotTrendRepository } from '../../../domain/repositories/lot-trend.repository';
import { ReportsPage } from './reports-page';

// Chart.js needs a real canvas, which the test environment does not provide, so only its constructor is replaced.
vi.mock('chart.js/auto', () => ({
  default: vi.fn(function ChartStub() {
    return { destroy: vi.fn() };
  }),
}));

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

const period ={ from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' };

function series(overrides: Partial<TrendSeries> = {}): TrendSeries {
  return {
    ranchId: 'ranch-1', lotId: 'lot-1', period, updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform',
    metric: 'body-temperature', unit: 'celsius', lotAverage: 39, outlierDeviation: 1,
    points: [
      { cattleId: 'cattle-1', recordedAt: '2026-11-10T08:00:00Z', value: 38 },
      { cattleId: 'cattle-2', recordedAt: '2026-11-10T08:00:00Z', value: 39 },
      { cattleId: 'cattle-3', recordedAt: '2026-11-10T08:00:00Z', value: 40 },
    ],
    outlierAnimals: [], missingReadings: null, coverageReason: 'Expected readings are unavailable for part of the lot.',
    unavailableReason: null, ...overrides,
  };
}

const curve: EpidemiologicalCurve = {
  ranchId: 'ranch-1', period, updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform', condition: 'temperature',
  newCasesByDay: { '2026-11-02': 2, '2026-11-03': 1 }, daysWithoutNewCases: 3, supportsRestrictionLifting: true, unavailableReason: null,
};

const indicators: HerdIndicators = {
  ranchId: 'ranch-1', period, updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform',
  monitoredAnimals: { value: 40, unit: 'animals', formula: 'distinct animals with valid period readings', denominator: 40, unavailableReason: null },
  openAlertsByType: { temperature: 1 }, alertsUnavailableReason: null,
  outsideGeofenceAnimals: { value: 0, unit: 'animals', formula: 'animals outside their assigned geofence at the period end', denominator: 40, unavailableReason: null },
  mortalityRate: { value: 0, unit: 'percent', formula: '100 * deaths during period / animals at risk during period', denominator: 40, unavailableReason: null },
  births: { value: null, unit: 'events', formula: 'recorded births during the period', denominator: null, unavailableReason: 'Birth observations are unavailable.' },
  confirmedPregnancies: { value: null, unit: 'events', formula: 'confirmed pregnancies during the period', denominator: null, unavailableReason: 'Pregnancy observations are unavailable.' },
  excludedAnimals: 0, missingReadings: null, readingsCoverageReason: null,
};

describe('ReportsPage', () => {
  let trends: { lotTrend: ReturnType<typeof vi.fn>; animalComparison: ReturnType<typeof vi.fn> };

  function configure(tab: string): void {
    TestBed.resetTestingModule();
    trends = {
      lotTrend: vi.fn(async (_ranch: string, query: { deviation: number }) => query.deviation === 1
        ? series()
        : series({ outlierAnimals: ['cattle-3'], outlierDeviation: query.deviation })),
      animalComparison: vi.fn(async (): Promise<AnimalComparison> => ({
        cattleId: 'cattle-3', reference: series(), animalAverage: 40, deviation: 1, referenceAnimalCount: 3, unavailableReason: null,
      })),
    };
    const document: ExecutiveReportDocument = { generatedAt: '2026-11-12T00:00:00Z', indicators };
    TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ tab, cattle: 'cattle-3' })) },
        },
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
        {
          provide: CattleInformationContextFacade,
          useValue: {
            lotMembers: vi.fn(async () => [{ lotId: 'lot-1', name: 'Milking group', cattleIds: ['cattle-1', 'cattle-2', 'cattle-3'] }]),
            cattleSummaries: vi.fn(async () => [
              { cattleId: 'cattle-1', earTag: '101', status: 'Active' },
              { cattleId: 'cattle-2', earTag: '102', status: 'Active' },
              { cattleId: 'cattle-3', earTag: '103', status: 'Active' },
            ]),
          },
        },
        { provide: LotTrendRepository, useValue: trends },
        { provide: EpidemiologicalCurveRepository, useValue: { curve: vi.fn(async () => curve) } },
        { provide: HerdIndicatorRepository, useValue: { dashboard: vi.fn(async () => indicators) } },
        {
          provide: ExecutiveReportRepository,
          useValue: { document: vi.fn(async () => document), csv: vi.fn() },
        },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
  }

  /** Lets the facades finish their reads, which start from effects, before the DOM is inspected. */
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ReportsPage);
    for (let pass = 0; pass < 4; pass++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the lot trend with the flagged animal by ear tag and the comparison of the preferred animal', async () => {
    configure('trends');
    const element = await render();
    const text = element.textContent.replace(/\s+/g, ' ');

    expect(text).toContain('Lot average');
    expect(element.querySelector('#outliers-heading')?.textContent).toContain('Flagged animals');
    expect(element.querySelector('.data-table')?.textContent).toContain('103');
    const comparison = Array.from<HTMLElement>(element.querySelectorAll('dl.comparison dd')).map(item => item.textContent.trim());
    expect(comparison).toEqual(['40 °C', '39 °C', '+1 °C', '3']);
    expect(text).not.toContain('cattle-3');
  });

  it('shows the epidemiological curve with the restriction hint and the attack rate from the herd size', async () => {
    configure('epidemiology');
    const text = (await render()).textContent.replace(/\s+/g, ' ');

    expect(text).toContain('Cases in the period');
    expect(text).toContain('The days without new cases cover the incubation period, so the restriction can be reviewed.');
    expect(text).toContain('7.5 %');
  });

  it('previews the executive report indicators with the reason of every unavailable value', async () => {
    configure('executive');
    const text = (await render()).textContent.replace(/\s+/g, ' ');

    expect(text).toContain('Monitored animals');
    expect(text).toContain('Birth records are not available.');
    expect(text).toContain('Download CSV');
  });
});
