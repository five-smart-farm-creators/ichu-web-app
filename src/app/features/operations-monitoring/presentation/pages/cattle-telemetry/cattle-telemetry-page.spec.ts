import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { LineChart } from '../../../../../shared/presentation/charts/line-chart';
import { TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import type { MonitoredCattleSummary } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import type { MonitoringThreshold } from '../../../domain/model/monitoring-threshold.model';
import type {
  LatestIndicator, LatestTelemetry, TelemetryMeasurement, TelemetryPage, TelemetryReading,
} from '../../../domain/model/telemetry.model';
import { MonitoringThresholdRepository } from '../../../domain/repositories/monitoring-threshold.repository';
import { TelemetryRepository } from '../../../domain/repositories/telemetry.repository';
import { CattleTelemetryPage } from './cattle-telemetry-page';

// Chart.js needs a real canvas, which the test environment does not provide, so only its constructor is replaced.
vi.mock('chart.js/auto', () => ({
  default: vi.fn(function ChartStub() {
    return { destroy: vi.fn() };
  }),
}));

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

const animal: MonitoredCattleSummary = { cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' };

const calfHeartRate: MonitoringThreshold = {
  thresholdId: 'threshold-1', lifeStage: 'Calf', metric: 'HeartRate', minValue: 60, maxValue: 90, severity: 'Warning', revision: 1,
};

function indicator(value: number | null, unit: string): LatestIndicator {
  return {
    status: value === null ? 'Unavailable' : 'Available',
    value,
    unit,
    recordedAt: value === null ? null : '2026-11-10T00:00:00Z',
    isStale: value === null ? null : false,
  };
}

const latest: LatestTelemetry = {
  cattleId: 'cattle-1',
  evaluatedAt: '2026-11-10T00:00:00Z',
  lastReadingRecordedAt: '2026-11-10T00:00:00Z',
  bodyTemperature: indicator(38.5, 'celsius'),
  heartRate: indicator(72, 'bpm'),
  activityIndex: indicator(10, 'index'),
  methaneIndex: indicator(4.2, 'index'),
  ruminationMinutes: indicator(null, 'minutes'),
  lastKnownPosition: { status: 'Unavailable', latitude: null, longitude: null, accuracyMeters: null, recordedAt: null, isStale: null },
};

function measurement(value: number | null, unit: string): TelemetryMeasurement {
  return { value, unit, status: value === null ? 'Absent' : 'Valid', invalidReason: null };
}

function reading(index: number, heartRate: number): TelemetryReading {
  return {
    readingId: `reading-${index}`,
    recordedAt: '2026-11-10T00:00:00Z',
    bodyTemperature: measurement(38.5, 'celsius'),
    heartRate: measurement(heartRate, 'bpm'),
    activityIndex: measurement(10, 'index'),
    methaneIndex: measurement(4.2, 'index'),
    ruminationMinutes: measurement(null, 'minutes'),
    batteryLevel: measurement(80, 'percent'),
    position: { latitude: null, longitude: null, accuracyMeters: null, status: 'Absent', invalidReason: null },
  };
}

/** One heart rate inside the band and one above it, so half of the valid readings fall outside. */
const readingsPage: TelemetryPage = {
  from: '2026-11-09T00:00:00Z', to: '2026-11-10T00:00:00Z', oldestRetainedRecordedAt: null,
  page: 1, pageSize: 100, totalCount: 2, items: [reading(1, 70), reading(2, 95)],
};

/** Collapses whitespace so assertions do not depend on how the template is laid out. */
function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('CattleTelemetryPage', () => {
  let telemetry: { latest: ReturnType<typeof vi.fn>; readings: ReturnType<typeof vi.fn> };
  let thresholds: { list: ReturnType<typeof vi.fn> };
  let exports: { exportExcel: ReturnType<typeof vi.fn>; exportPdf: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    telemetry = { latest: vi.fn(async () => latest), readings: vi.fn(async () => readingsPage) };
    thresholds = { list: vi.fn(async () => [calfHeartRate]) };
    exports = { exportExcel: vi.fn(async () => undefined), exportPdf: vi.fn(async () => undefined) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CattleTelemetryPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ cattleId: 'cattle-1' })) } },
        {
          provide: IamContextFacade,
          useValue: {
            currentRanchId: signal('ranch-1'),
            currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture' }),
            ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture' }]),
          },
        },
        { provide: TelemetryRepository, useValue: telemetry },
        { provide: MonitoringThresholdRepository, useValue: thresholds },
        { provide: CattleInformationContextFacade, useValue: { monitoredCattleById: vi.fn(async () => animal) } },
        { provide: TableExportService, useValue: exports },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /** Renders the page and lets the animal, latest value, threshold and reading reads settle. */
  async function render() {
    const fixture = TestBed.createComponent(CattleTelemetryPage);
    fixture.detectChanges();
    for (let turn = 0; turn < 5; turn++) {
      await new Promise(resolve => setTimeout(resolve));
      fixture.detectChanges();
    }
    await fixture.whenStable();
    return fixture;
  }

  it('shows heart rate and the relative methane index with their units', async () => {
    const text = textOf((await render()).nativeElement);

    expect(text).toContain('72 bpm');
    expect(text).toContain('4.2 index');
    expect(text).toContain('Methane index (relative, not ppm)');
    expect(text).toContain('The methane index is relative and is not a concentration in ppm.');
  });

  it('charts heart rate against its threshold band and the methane index without a band', async () => {
    const fixture = await render();
    const charts = fixture.debugElement.queryAll(By.directive(LineChart)).map(item => item.componentInstance as LineChart);
    const heartRate = charts.find(chart => chart.series()[0]?.label === 'Heart rate');
    const methane = charts.find(chart => chart.series()[0]?.label === 'Methane index (relative, not ppm)');

    expect(heartRate?.band()).toEqual(expect.objectContaining({ min: 60, max: 90 }));
    expect(methane).toBeDefined();
    expect(methane?.band()).toBeNull();
  });

  it('summarizes heart rate against its band and the methane index without one in the statistics table', async () => {
    const fixture = await render();
    const statistics: HTMLElement = fixture.nativeElement.querySelector('section[aria-labelledby="statistics-heading"]');
    const rows = Array.from<HTMLElement>(statistics.querySelectorAll('tbody tr'));
    const rowFor = (label: string) => rows.find(row => textOf(row.querySelector('th')) === label);

    expect(Array.from(rowFor('Heart rate')?.querySelectorAll('td') ?? [], textOf))
      .toEqual(['2', '70', '95', '82.5', '17.7', '50 %']);
    expect(Array.from(rowFor('Methane index (relative, not ppm)')?.querySelectorAll('td') ?? [], textOf))
      .toEqual(['2', '4.2', '4.2', '4.2', '0', '–']);
  });

  it('adds heart rate and methane index to the readings table and to the export', async () => {
    const fixture = await render();
    const headers = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('th[mat-header-cell]')).map(cell => textOf(cell));

    expect(headers).toEqual([
      'Recorded at', 'Body temperature', 'Heart rate', 'Activity index', 'Methane index (relative, not ppm)',
      'Rumination (minutes)', 'Battery level', 'Position',
    ]);

    await fixture.componentInstance.export('excel');
    const columns = exports.exportExcel.mock.calls[0]?.[1] as { header: string }[];
    expect(columns.map(column => column.header)).toEqual([
      'Recorded at', 'Body temperature (°C)', 'Heart rate (bpm)', 'Activity index', 'Methane index (relative, not ppm)',
      'Rumination (minutes)', 'Battery level', 'Position',
    ]);
  });
});
