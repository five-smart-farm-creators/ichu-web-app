import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Chart, ChartDataset } from 'chart.js';
import { formatLocaleTag } from '../../infrastructure/i18n/language';
import { LanguageService } from '../../infrastructure/i18n/language.service';

/** One plotted point; `y: null` is a gap for an absent or invalid reading, never a zero. */
export interface ChartPoint {
  readonly x: Date;
  readonly y: number | null;
}

/** A plotted series; `color` is a CSS custom property such as `--forest`, resolved when the chart is drawn. */
export interface ChartSeries {
  readonly label: string;
  readonly color: string;
  readonly points: readonly ChartPoint[];
}

/** Dashed reference lines for the limits of a normal range. */
export interface ChartBand {
  readonly min: number;
  readonly max: number;
  readonly minLabel: string;
  readonly maxLabel: string;
}

interface SeriesSummary {
  readonly label: string;
  readonly minimum: string;
  readonly maximum: string;
  readonly average: string;
}

/** Plots series over time with Chart.js, which loads on first use; a hidden summary repeats the numbers for screen readers. */
@Component({
  selector: 'ichu-line-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="chart-frame"><canvas #canvas role="img" [attr.aria-label]="accessibleLabel()"></canvas></div>
    <ul class="visually-hidden">
      @for (summary of summaries(); track summary.label) {
        <li>{{ 'common.chart.summary' | translate: { label: summary.label, minimum: summary.minimum, maximum: summary.maximum, average: summary.average } }}</li>
      } @empty {
        <li>{{ 'common.chart.noData' | translate }}</li>
      }
    </ul>`,
  styles: ':host{display:block}.chart-frame{position:relative;height:280px;width:100%}',
})
export class LineChart {
  private readonly language = inject(LanguageService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly series = input<readonly ChartSeries[]>([]);
  readonly band = input<ChartBand | null>(null);
  readonly yAxisLabel = input('');
  readonly accessibleLabel = input('');
  private chart: Chart | null = null;
  private drawRequest = 0;
  private rendered = false;

  readonly summaries = computed<readonly SeriesSummary[]>(() => {
    const format = new Intl.NumberFormat(formatLocaleTag(this.language.current()), { maximumFractionDigits: 1 });
    const text = (value: number | null): string => (value === null ? '–' : format.format(value));
    return this.series().map(series => {
      const values = series.points.map(point => point.y).filter((value): value is number => value !== null && Number.isFinite(value));
      const minimum = values.length ? Math.min(...values) : null;
      const maximum = values.length ? Math.max(...values) : null;
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return { label: series.label, minimum: text(minimum), maximum: text(maximum), average: text(average) };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
    afterNextRender(() => {
      this.rendered = true;
      void this.draw();
    });
    effect(() => {
      this.series();
      this.band();
      this.yAxisLabel();
      this.language.current();
      untracked(() => {
        if (this.rendered) void this.draw();
      });
    });
  }

  private async draw(): Promise<void> {
    const request = ++this.drawRequest;
    const { default: ChartConstructor } = await import('chart.js/auto');
    if (request !== this.drawRequest) return;
    this.chart?.destroy();

    const locale = formatLocaleTag(this.language.current());
    const timeFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const series = this.series();
    const datasets: ChartDataset<'line'>[] = series.map(item => ({
      label: item.label,
      data: item.points.map(point => ({ x: point.x.getTime(), y: point.y })),
      borderColor: cssColor(item.color),
      backgroundColor: cssColor(item.color),
      borderWidth: 2,
      pointRadius: 2,
      spanGaps: false,
      tension: 0.2,
    }));
    const band = this.band();
    const times = series.flatMap(item => item.points.map(point => point.x.getTime()));
    if (band && times.length > 0) {
      const first = Math.min(...times);
      const last = Math.max(...times);
      const reference = { borderColor: cssColor('--danger'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false };
      datasets.push({ ...reference, label: band.minLabel, data: [{ x: first, y: band.min }, { x: last, y: band.min }] });
      datasets.push({ ...reference, label: band.maxLabel, data: [{ x: first, y: band.max }, { x: last, y: band.max }] });
    }

    this.chart = new ChartConstructor(this.canvas().nativeElement, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        scales: {
          x: { type: 'linear', ticks: { maxRotation: 0, autoSkip: true, callback: value => timeFormat.format(new Date(Number(value))) } },
          y: { title: { display: this.yAxisLabel() !== '', text: this.yAxisLabel() } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }
}

/** Canvas drawing takes literal colors, so design tokens are read from the document when the chart is drawn. */
function cssColor(color: string): string {
  if (!color.startsWith('--')) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(color).trim() || '#33513e';
}
