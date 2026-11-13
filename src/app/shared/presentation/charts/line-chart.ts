import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Chart, ChartDataset, Plugin } from 'chart.js';
import { formatLocaleTag } from '../../infrastructure/i18n/language';
import { LanguageService } from '../../infrastructure/i18n/language.service';
import { ThemeService } from '../theme/theme.service';
import { cssColor, loadChartJs } from './chart-loader';

/** One plotted point; `y: null` is a gap for an absent or invalid reading, never a zero. */
export interface ChartPoint {
  readonly x: Date;
  readonly y: number | null;
}

/** A plotted series; `color` is a CSS custom property such as `--forest`, resolved when the chart is drawn.
 * `markersOnly` draws the points without joining them, to highlight individual readings. */
export interface ChartSeries {
  readonly label: string;
  readonly color: string;
  readonly points: readonly ChartPoint[];
  readonly markersOnly?: boolean;
}

/** Dashed reference lines for the limits of a normal range. */
export interface ChartBand {
  readonly min: number;
  readonly max: number;
  readonly minLabel: string;
  readonly maxLabel: string;
}

/** A filled band between `lower` and `upper`, such as a mean plus or minus one standard deviation; a null edge leaves a gap. */
export interface ChartArea {
  readonly label: string;
  readonly color: string;
  readonly lower: readonly ChartPoint[];
  readonly upper: readonly ChartPoint[];
}

/** A dashed horizontal line at one value across the plotted range, such as an alert threshold. */
export interface ChartLimit {
  readonly value: number;
  readonly label: string;
}

/** `reading` labels ticks with the day and time of a reading; `day` labels them with the day only. */
export type ChartTimeUnit = 'reading' | 'day';

/** A dashed vertical line at a moment, such as a ration change, with its label at the top. */
export interface ChartMarker {
  readonly x: Date;
  readonly label: string;
}

interface SeriesSummary {
  readonly label: string;
  readonly minimum: string;
  readonly maximum: string;
  readonly average: string;
}

const READING_TICK_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
const DAY_TICK_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
const DAY_MILLISECONDS = 86_400_000;

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
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly series = input<readonly ChartSeries[]>([]);
  readonly band = input<ChartBand | null>(null);
  readonly area = input<ChartArea | null>(null);
  readonly limit = input<ChartLimit | null>(null);
  readonly markers = input<readonly ChartMarker[]>([]);
  readonly timeUnit = input<ChartTimeUnit>('reading');
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
      this.area();
      this.limit();
      this.markers();
      this.timeUnit();
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

    const locale = formatLocaleTag(this.language.current());
    const timeFormat = new Intl.DateTimeFormat(locale, this.timeUnit() === 'day' ? DAY_TICK_FORMAT : READING_TICK_FORMAT);
    const series = this.series();
    const datasets: ChartDataset<'line'>[] = series.map(item => ({
      label: item.label,
      data: toDataPoints(item.points),
      borderColor: cssColor(item.color),
      backgroundColor: cssColor(item.color),
      borderWidth: item.markersOnly ? 0 : 2,
      showLine: !item.markersOnly,
      pointRadius: item.markersOnly ? 5 : 2,
      spanGaps: false,
      tension: 0.2,
    }));
    const times = series.flatMap(item => item.points.map(point => point.x.getTime()));
    if (times.length > 0) {
      const first = Math.min(...times);
      const last = Math.max(...times);
      const reference = { borderColor: cssColor('--danger'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false };
      const band = this.band();
      if (band) {
        datasets.push({ ...reference, label: band.minLabel, data: [{ x: first, y: band.min }, { x: last, y: band.min }] });
        datasets.push({ ...reference, label: band.maxLabel, data: [{ x: first, y: band.max }, { x: last, y: band.max }] });
      }
      const limit = this.limit();
      if (limit) {
        datasets.push({ ...reference, label: limit.label, data: [{ x: first, y: limit.value }, { x: last, y: limit.value }] });
      }
    }

    // Chart.js paints the highest dataset index first, so the area goes last and sits beneath the lines and the series.
    const areaStart = datasets.length;
    const area = this.area();
    if (area) {
      const edge = { label: area.label, borderWidth: 0, pointRadius: 0, spanGaps: false, tension: 0 };
      datasets.push({ ...edge, data: toDataPoints(area.lower), fill: false });
      datasets.push({ ...edge, data: toDataPoints(area.upper), fill: '-1', backgroundColor: cssColor(area.color) });
    }

    const muted = cssColor('--muted');
    const grid = cssColor('--border');
    this.chart = new ChartConstructor(this.canvas().nativeElement, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        scales: {
          x: {
            type: 'linear',
            grid: { color: grid },
            // One tick per day; a linear scale would otherwise add half-day ticks that repeat each date label.
            ticks: {
              color: muted, maxRotation: 0, autoSkip: true, stepSize: this.timeUnit() === 'day' ? DAY_MILLISECONDS : undefined,
              callback: value => timeFormat.format(new Date(Number(value))),
            },
          },
          y: {
            grid: { color: grid },
            ticks: { color: muted },
            title: { display: this.yAxisLabel() !== '', text: this.yAxisLabel() },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            // The lower edge of the area is only a boundary, so the legend names the band once.
            labels: { color: muted, filter: item => item.datasetIndex !== areaStart },
          },
          tooltip: {
            // Band edges are not readings, so the tooltip shows only the series and the reference lines.
            filter: item => item.datasetIndex < areaStart,
            callbacks: {
              title: items => {
                const raw = items[0]?.raw as { readonly x: number } | undefined;
                return raw ? timeFormat.format(new Date(raw.x)) : '';
              },
            },
          },
        },
      },
      plugins: [markerPlugin(this.markers(), muted)],
    });
  }
}

/** Chart.js reads the time axis as timestamps, so dates are converted once here. */
function toDataPoints(points: readonly ChartPoint[]): { x: number; y: number | null }[] {
  return points.map(point => ({ x: point.x.getTime(), y: point.y }));
}

/** Draws each marker behind the series as a dashed line across the plot, with its label at the top. */
function markerPlugin(markers: readonly ChartMarker[], color: string): Plugin<'line'> {
  return {
    id: 'ichuMarkers',
    afterDatasetsDraw(chart) {
      const area = chart.chartArea;
      const scale = chart.scales['x'];
      if (!area || !scale || markers.length === 0) return;
      const context = chart.ctx;
      context.save();
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 1.5;
      context.setLineDash([4, 4]);
      context.font = '12px "Plus Jakarta Sans Variable", sans-serif';
      for (const marker of markers) {
        const position = scale.getPixelForValue(marker.x.getTime());
        if (position < area.left || position > area.right) continue;
        context.beginPath();
        context.moveTo(position, area.top);
        context.lineTo(position, area.bottom);
        context.stroke();
        context.fillText(marker.label, position + 4, area.top + 12);
      }
      context.restore();
    },
  };
}
