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

/** The parts of the Chart.js configuration these tests read, as the component builds them. */
interface ChartConfig {
  readonly data: { readonly datasets: readonly { readonly label: string; readonly fill?: unknown }[] };
  readonly options: {
    readonly scales: { readonly x: { readonly ticks: { readonly callback: (value: number) => string } } };
    readonly plugins: {
      readonly legend: { readonly labels: { readonly filter: (item: { readonly datasetIndex: number }) => boolean } };
      readonly tooltip: {
        readonly filter: (item: { readonly datasetIndex: number }) => boolean;
        readonly callbacks: { readonly title: (items: readonly { readonly raw: unknown }[]) => string };
      };
    };
  };
}

/** Renders a chart with the given inputs and returns the configuration Chart.js was constructed with. */
async function drawChart(inputs: Record<string, unknown>): Promise<ChartConfig> {
  const chart = (await import('chart.js/auto')).default as unknown as ReturnType<typeof vi.fn>;
  chart.mockClear();
  const fixture = TestBed.createComponent(LineChart);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  await vi.waitFor(() => expect(chart).toHaveBeenCalled());
  return chart.mock.calls[0][1] as ChartConfig;
}

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

  it('hands Chart.js a plugin that draws the markers, such as a ration change, over the plot', async () => {
    const chart = (await import('chart.js/auto')).default as unknown as ReturnType<typeof vi.fn>;
    chart.mockClear();
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('markers', [{ x: new Date('2026-11-05T00:00:00'), label: 'Ration change' }]);
    fixture.detectChanges();

    await vi.waitFor(() => expect(chart).toHaveBeenCalled());
    const config = chart.mock.calls[0][1] as { plugins: { id: string }[] };
    expect(config.plugins.map(plugin => plugin.id)).toEqual(['ichuMarkers']);
  });

  it('draws the area beneath the series and keeps its edges out of the legend and the tooltip', async () => {
    const day = new Date(2026, 10, 10, 12);
    const config = await drawChart({
      series: [{ label: 'Mean', color: '--forest', points: [{ x: day, y: 38.5 }] }],
      area: { label: 'Band', color: '--green-soft', lower: [{ x: day, y: 38.2 }], upper: [{ x: day, y: 38.8 }] },
    });

    expect(config.data.datasets.map(dataset => dataset.label)).toEqual(['Mean', 'Band', 'Band']);
    expect(config.data.datasets[2].fill).toBe('-1');
    expect(config.options.plugins.legend.labels.filter({ datasetIndex: 1 })).toBe(false);
    expect(config.options.plugins.legend.labels.filter({ datasetIndex: 2 })).toBe(true);
    expect(config.options.plugins.tooltip.filter({ datasetIndex: 0 })).toBe(true);
    expect(config.options.plugins.tooltip.filter({ datasetIndex: 1 })).toBe(false);
    expect(config.options.plugins.tooltip.filter({ datasetIndex: 2 })).toBe(false);
  });

  it('draws the limit as a labelled dashed line across the plotted range', async () => {
    const first = new Date(2026, 10, 10, 12);
    const last = new Date(2026, 10, 12, 12);
    const config = await drawChart({
      series: [{ label: 'Mean', color: '--forest', points: [{ x: first, y: 38.5 }, { x: last, y: 38.7 }] }],
      limit: { value: 39.5, label: 'Alert threshold 39.5 °C' },
    });

    expect(config.data.datasets.at(-1)).toMatchObject({
      label: 'Alert threshold 39.5 °C',
      data: [{ x: first.getTime(), y: 39.5 }, { x: last.getTime(), y: 39.5 }],
    });
  });

  it('labels the ticks with the day and month only for day charts', async () => {
    const config = await drawChart({
      timeUnit: 'day',
      series: [{ label: 'Mean', color: '--forest', points: [{ x: new Date(2026, 10, 10, 12), y: 38.5 }] }],
    });

    expect(config.options.scales.x.ticks.callback(new Date(2026, 10, 10, 12).getTime())).toBe('Nov 10');
  });

  it('titles a tooltip with the reading date instead of the raw timestamp', async () => {
    const reading = new Date(2026, 10, 10, 12);
    const config = await drawChart({ series: [{ label: 'Mean', color: '--forest', points: [{ x: reading, y: 38.5 }] }] });

    expect(config.options.plugins.tooltip.callbacks.title([{ raw: { x: reading.getTime(), y: 38.5 } }])).toContain('Nov 10');
  });
});
