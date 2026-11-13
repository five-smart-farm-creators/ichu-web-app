import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Chart, ChartConfiguration, ChartDataset } from 'chart.js';
import { formatLocaleTag } from '../../infrastructure/i18n/language';
import { LanguageService } from '../../infrastructure/i18n/language.service';
import { ThemeService } from '../theme/theme.service';
import { cssColor, loadChartJs } from './chart-loader';

/** One series over the category labels; `kind` draws it as bars, or as a line over them. */
export interface BarChartSeries {
  readonly label: string;
  readonly color: string;
  readonly kind: 'bar' | 'line';
  readonly values: readonly (number | null)[];
}

interface SeriesSummary {
  readonly label: string;
  readonly minimum: string;
  readonly maximum: string;
  readonly average: string;
}

/** Plots counts per category with Chart.js, which loads on first use; a hidden summary repeats the numbers for screen readers. */
@Component({
  selector: 'ichu-bar-chart',
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
export class BarChart {
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly labels = input<readonly string[]>([]);
  readonly series = input<readonly BarChartSeries[]>([]);
  readonly yAxisLabel = input('');
  readonly accessibleLabel = input('');
  private chart: Chart | null = null;
  private drawRequest = 0;
  private rendered = false;

  readonly summaries = computed<readonly SeriesSummary[]>(() => {
    const format = new Intl.NumberFormat(formatLocaleTag(this.language.current()), { maximumFractionDigits: 1 });
    const text = (value: number | null): string => (value === null ? '–' : format.format(value));
    return this.series().map(series => {
      const values = series.values.filter((value): value is number => value !== null && Number.isFinite(value));
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
      this.labels();
      this.series();
      this.yAxisLabel();
      this.language.current();
      this.theme.current();
      untracked(() => {
        if (this.rendered) void this.draw();
      });
    });
  }

  private async draw(): Promise<void> {
    const request = ++this.drawRequest;
    const ChartConstructor = await loadChartJs();
    if (request !== this.drawRequest) return;
    this.chart?.destroy();

    const datasets: ChartDataset<'bar' | 'line'>[] = this.series().map(item => ({
      type: item.kind,
      label: item.label,
      data: [...item.values],
      backgroundColor: cssColor(item.color),
      borderColor: cssColor(item.color),
      borderWidth: item.kind === 'bar' ? 0 : 2,
      pointRadius: 2,
      spanGaps: false,
      tension: 0.2,
    }));
    const muted = cssColor('--muted');
    const grid = cssColor('--border');
    const configuration: ChartConfiguration<'bar' | 'line'> = {
      type: 'bar',
      data: { labels: [...this.labels()], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { grid: { color: grid }, ticks: { color: muted } },
          y: {
            beginAtZero: true,
            grid: { color: grid },
            ticks: { color: muted },
            title: { display: this.yAxisLabel() !== '', text: this.yAxisLabel() },
          },
        },
        plugins: { legend: { position: 'bottom', labels: { color: muted } } },
      },
    };
    this.chart = new ChartConstructor(this.canvas().nativeElement, configuration);
  }
}
