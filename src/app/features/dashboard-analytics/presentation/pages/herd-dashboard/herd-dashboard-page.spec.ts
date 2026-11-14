import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { IotAssetsContextFacade } from '../../../../iot-assets/application/acl/iot-assets-context.facade';
import {
  OperationsMonitoringContextFacade, type RecentAlertSummary,
} from '../../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { PlanningContextFacade } from '../../../../planning/application/acl/planning-context.facade';
import type { HerdIndicators, IndicatorValue } from '../../../domain/model/herd-indicators.model';
import type { TrendPoint, TrendSeries } from '../../../domain/model/lot-trend.model';
import { HerdIndicatorRepository } from '../../../domain/repositories/herd-indicator.repository';
import { LotTrendRepository } from '../../../domain/repositories/lot-trend.repository';
import { HerdDashboardPage } from './herd-dashboard-page';

// Chart.js needs a real canvas, which the test environment does not provide, so only its constructor is replaced.
vi.mock('chart.js/auto', () => ({
  default: vi.fn(function ChartStub() {
    return { destroy: vi.fn() };
  }),
}));

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

function trendSeries(overrides: Partial<TrendSeries> = {}): TrendSeries {
  return {
    ranchId: 'ranch-1', lotId: 'lot-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' },
    updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform', metric: 'body-temperature', unit: 'celsius',
    lotAverage: null, outlierDeviation: 1, points: [], outlierAnimals: [], missingReadings: null,
    coverageReason: null, unavailableReason: null, ...overrides,
  };
}

function reading(cattleId: string, value: number, recordedAt: Date): TrendPoint {
  return { cattleId, value, recordedAt: recordedAt.toISOString() };
}

function alert(overrides: Partial<RecentAlertSummary>): RecentAlertSummary {
  return {
    alertId: 'alert-1', cattleId: 'cattle-1', type: 'Temperature', severity: 'Warning', raisedAt: '2026-11-12T07:30:00.000Z',
    detectedValue: 39.9, unit: 'celsius', distanceToBoundaryMeters: null, ...overrides,
  };
}

/** Collapses whitespace so assertions do not depend on how the template is laid out. */
function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ');
}

describe('HerdDashboardPage', () => {
  let indicators: { dashboard: ReturnType<typeof vi.fn> };
  let trends: { lotTrend: ReturnType<typeof vi.fn> };
  let monitoring: { recentAlerts: ReturnType<typeof vi.fn>; bodyTemperatureLimit: ReturnType<typeof vi.fn> };
  let iotAssets: { collarConnectivity: ReturnType<typeof vi.fn> };
  let cattle: { cattleSummaries: ReturnType<typeof vi.fn>; lotSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    indicators = { dashboard: vi.fn(async () => report) };
    trends = { lotTrend: vi.fn(async () => trendSeries()) };
    monitoring = { recentAlerts: vi.fn(async () => []), bodyTemperatureLimit: vi.fn(async () => null) };
    iotAssets = { collarConnectivity: vi.fn(async () => ({ communicating: 0, noCommunication: 0, neverReported: 0, lowBattery: 0 })) };
    cattle = {
      cattleSummaries: vi.fn(async () => []),
      lotSummaries: vi.fn(async () => [{ lotId: 'lot-1', name: 'Heifers' }]),
    };
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
        { provide: HerdIndicatorRepository, useValue: indicators },
        { provide: PlanningContextFacade, useValue: { upcomingActivities: vi.fn(async () => []) } },
        { provide: CattleInformationContextFacade, useValue: cattle },
        { provide: LotTrendRepository, useValue: trends },
        { provide: OperationsMonitoringContextFacade, useValue: monitoring },
        { provide: IotAssetsContextFacade, useValue: iotAssets },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /** Renders the page and waits until the dashboard reads have settled. */
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HerdDashboardPage);
    fixture.detectChanges();
    // The reads chain several promises, which whenStable does not wait for; one macrotask lets them all finish.
    await new Promise(resolve => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows "Not available" with the API reason for every indicator the API could not observe', async () => {
    const text = textOf(await render());

    expect(text).toContain('Birth records are not available.');
    expect(text).toContain('Confirmed pregnancies are not recorded yet.');
    expect(text).toContain('The alert data is incomplete.');
    expect(text).toContain('The number of missing readings is not available.');
  });

  it('keeps a real zero as zero and reads the monitored animals from the report', async () => {
    const element = await render();
    const tiles: string[] = Array.from<HTMLElement>(element.querySelectorAll('.indicator-tile .stat-value'))
      .map(value => value.textContent.replace(/\s+/g, ' ').trim());

    expect(tiles).toEqual(['12 animals', '1 animal', '0 %', 'Not available', 'Not available']);
  });

  it('never renders the ranch identifier', async () => {
    const element = await render();

    expect(element.textContent).not.toContain('ranch-1');
  });

  it('shows the total of open alerts with the count of each type that has alerts', async () => {
    indicators.dashboard.mockResolvedValue({ ...report, openAlertsByType: { temperature: 2, activity: 0, geofence: 1 } });

    const card = (await render()).querySelector<HTMLElement>('.kpi-grid > article.stat');

    expect(card?.getAttribute('data-tone')).toBe('danger');
    expect(card?.querySelector('.stat-value')?.textContent?.trim()).toBe('3');
    expect(textOf(card)).toContain('Temperature 2 · Geofence 1');
  });

  it('lists the newest alerts with their ear tag, type, measure and severity', async () => {
    monitoring.recentAlerts.mockResolvedValue([
      alert({ alertId: 'alert-1', cattleId: 'cattle-1', type: 'Temperature', severity: 'Critical', detectedValue: 40.1, unit: 'celsius' }),
      alert({ alertId: 'alert-2', cattleId: 'cattle-2', type: 'Geofence', severity: 'Warning', detectedValue: null, unit: null, distanceToBoundaryMeters: 12.4 }),
    ]);
    cattle.cattleSummaries.mockResolvedValue([
      { cattleId: 'cattle-1', earTag: 'A-102', status: 'Active' },
      { cattleId: 'cattle-2', earTag: 'B-17', status: 'Active' },
    ]);

    const element = await render();
    const text = textOf(element);

    expect(element.querySelectorAll('.alert-item')).toHaveLength(2);
    expect(text).toContain('A-102 · Temperature');
    expect(text).toContain('40.1 °C');
    expect(text).toContain('B-17 · Geofence');
    expect(text).toContain('12 m');
    expect(text).toContain('Critical');
  });

  it('labels heart rate alerts in the type breakdown and in the list', async () => {
    indicators.dashboard.mockResolvedValue({ ...report, openAlertsByType: { heartrate: 1 } });
    monitoring.recentAlerts.mockResolvedValue([
      alert({ alertId: 'alert-3', cattleId: 'cattle-1', type: 'HeartRate', severity: 'Warning', detectedValue: 96, unit: 'bpm' }),
    ]);
    cattle.cattleSummaries.mockResolvedValue([{ cattleId: 'cattle-1', earTag: 'A-102', status: 'Active' }]);

    const text = textOf(await render());

    expect(text).toContain('Heart rate 1');
    expect(text).toContain('A-102 · Heart rate');
    expect(text).toContain('96 bpm');
  });

  it('says that no alert is pending when the ranch has none', async () => {
    expect(textOf(await render())).toContain('No pending alerts.');
  });

  it('does not report "no pending alerts" while the alerts are still being read', async () => {
    monitoring.recentAlerts.mockReturnValue(new Promise(() => undefined));

    const panel = (await render()).querySelector<HTMLElement>('ichu-recent-alerts-panel');

    expect(panel?.querySelector('mat-progress-bar')).not.toBeNull();
    expect(textOf(panel)).not.toContain('No pending alerts.');
  });

  it('shows the collar counts, the low battery note and the same sentence as the bar label', async () => {
    iotAssets.collarConnectivity.mockResolvedValue({ communicating: 3, noCommunication: 1, neverReported: 2, lowBattery: 1 });

    const element = await render();
    const sentence = '3 connected · 1 without communication · 2 never reported';

    expect(textOf(element)).toContain(sentence);
    expect(textOf(element)).toContain('1 with low battery');
    expect(element.querySelector('.collar-bar')?.getAttribute('aria-label')).toBe(sentence);
    expect(element.querySelectorAll('.segment')).toHaveLength(3);
  });

  it('says that no collar is registered when the ranch has none', async () => {
    expect(textOf(await render())).toContain('No collars are registered yet.');
  });

  it('explains why the temperature chart is unavailable instead of drawing an empty one', async () => {
    trends.lotTrend.mockResolvedValue(trendSeries({ unavailableReason: 'There are no valid readings for this lot and metric.' }));

    const element = await render();

    expect(textOf(element)).toContain('There are no valid readings for this lot and metric in the period.');
    expect(element.querySelector('ichu-line-chart')).toBeNull();
  });

  it('shows the latest daily mean of the lot with the animals behind it', async () => {
    trends.lotTrend.mockResolvedValue(trendSeries({
      points: [
        reading('cattle-1', 38, new Date(2026, 10, 11, 10)),
        reading('cattle-1', 38.4, new Date(2026, 10, 12, 10)),
        reading('cattle-2', 38.8, new Date(2026, 10, 12, 10)),
      ],
    }));
    monitoring.bodyTemperatureLimit.mockResolvedValue(39.5);

    const element = await render();

    expect(element.querySelector('ichu-line-chart')).not.toBeNull();
    expect(textOf(element)).toContain('38.6 °C');
    expect(textOf(element)).toContain('2 animals with readings on the last day');
  });

  it('marks the period chip in use with aria-pressed', async () => {
    const element = await render();

    expect(element.querySelectorAll('.period-chips button')).toHaveLength(5);
    expect(element.querySelector('.period-chips button[aria-pressed="true"]')?.textContent?.trim()).toBe('Last 30 days');
  });

  it('keeps the indicators on the page when the alerts cannot be read', async () => {
    monitoring.recentAlerts.mockRejectedValue(new Error('The alert service is unavailable.'));

    const element = await render();

    expect(textOf(element)).toContain('12 animals');
    expect(element.querySelector('ichu-recent-alerts-panel [role="alert"]')).not.toBeNull();
  });
});
