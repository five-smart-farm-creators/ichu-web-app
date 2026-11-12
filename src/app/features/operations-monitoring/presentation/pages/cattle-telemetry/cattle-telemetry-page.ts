import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ChartBand, ChartPoint, ChartSeries, LineChart } from '../../../../../shared/presentation/charts/line-chart';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { provideLocalizedDateAdapter } from '../../../../../shared/presentation/localized-date-providers';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { CattleTelemetryFacade, TELEMETRY_READING_LIMIT } from '../../../application/services/cattle-telemetry.facade';
import {
  type LastKnownPosition, measurementValue, type MonitoredMetric, type TelemetryMeasurement, type TelemetryPeriod,
  type TelemetryPosition, type TelemetryReading,
} from '../../../domain/model/telemetry.model';
import { IndicatorValue } from '../../components/indicator-value';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';
import { formatMeasure } from '../../monitoring-format';

export type RangePreset = '24h' | '7d' | '30d' | 'custom';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const COORDINATE_DIGITS = 5;

/** One animal's monitoring: latest values, the readings of a period against its thresholds, statistics and exports. */
@Component({
  selector: 'ichu-cattle-telemetry-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    IndicatorValue,
    LineChart,
    LocalizedDatePipe,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [CattleTelemetryFacade, provideLocalizedDateAdapter(), { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './cattle-telemetry-page.html',
  styleUrl: './cattle-telemetry-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CattleTelemetryPage {
  readonly facade = inject(CattleTelemetryFacade);
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly readingLimit = TELEMETRY_READING_LIMIT;
  readonly presets: readonly RangePreset[] = ['24h', '7d', '30d', 'custom'];
  readonly pageSizeOptions = [10, 25, 50];
  readonly readingColumns = ['recordedAt', 'temperature', 'activity', 'rumination', 'battery', 'position'];
  readonly cattleId = toSignal(this.route.paramMap.pipe(map(params => params.get('cattleId') ?? '')), { initialValue: '' });
  readonly preset = signal<RangePreset>('24h');
  readonly rangeError = signal<string | null>(null);
  readonly readingsPageIndex = signal(0);
  readonly readingsPageSize = signal(10);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly rangeForm = new FormGroup({
    from: new FormControl<Date | null>(daysAgo(7)),
    to: new FormControl<Date | null>(new Date()),
  });
  readonly pagedReadings = computed(() => {
    const start = this.readingsPageIndex() * this.readingsPageSize();
    return this.facade.readings().slice(start, start + this.readingsPageSize());
  });
  readonly noThresholds = computed(() =>
    this.facade.animal() !== null && this.facade.bodyTemperatureBand() === null && this.facade.activityIndexBand() === null);
  readonly temperatureSeries = computed<ChartSeries[]>(() => [
    { label: this.metricLabel('BodyTemperature'), color: '--forest', points: this.points('bodyTemperature') },
  ]);
  readonly activitySeries = computed<ChartSeries[]>(() => [
    { label: this.metricLabel('ActivityIndex'), color: '--accent', points: this.points('activityIndex') },
  ]);
  readonly temperatureBand = computed(() => this.bandOf(this.facade.bodyTemperatureBand()));
  readonly activityBand = computed(() => this.bandOf(this.facade.activityIndexBand()));

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const cattleId = this.cattleId();
      untracked(() => {
        this.preset.set('24h');
        this.rangeError.set(null);
        this.readingsPageIndex.set(0);
        const period = this.periodFor('24h');
        if (period && cattleId) void this.facade.open(ranchId, cattleId, period);
      });
    });
  }

  /** A custom range runs from the start of its first day to the end of its last day. */
  applyRange(): void {
    const period = this.periodFor(this.preset());
    this.rangeError.set(period ? null : 'monitoring.telemetry.invalidRange');
    if (!period) return;
    this.readingsPageIndex.set(0);
    void this.facade.loadReadings(period);
  }

  onReadingsPage(event: PageEvent): void {
    this.readingsPageIndex.set(event.pageIndex);
    this.readingsPageSize.set(event.pageSize);
  }

  /** A valid measurement as text; null means the template shows the reason it has no value. */
  measurement(measure: TelemetryMeasurement): string | null {
    const value = measurementValue(measure);
    return value === null ? null : formatMeasure(value, this.dateLocale());
  }

  /** Coordinates of a reading or of the last known position; a missing position is never zero. */
  coordinates(latitude: number | null, longitude: number | null): string | null {
    if (latitude === null || longitude === null) return null;
    const locale = this.dateLocale();
    return `${formatMeasure(latitude, locale, COORDINATE_DIGITS)}, ${formatMeasure(longitude, locale, COORDINATE_DIGITS)}`;
  }

  lastKnownCoordinates(position: LastKnownPosition): string | null {
    return position.status === 'Available' ? this.coordinates(position.latitude, position.longitude) : null;
  }

  readingPosition(position: TelemetryPosition): string | null {
    return position.status === 'Valid' ? this.coordinates(position.latitude, position.longitude) : null;
  }

  pct(value: number | null): string {
    return value === null ? '–' : formatMeasure(value, this.dateLocale()) + ' %';
  }

  number(value: number | null): string {
    return formatMeasure(value, this.dateLocale());
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const readings = this.facade.readings();
      const columns = this.exportColumns();
      const name = 'ichu-telemetry';
      if (format === 'excel') {
        await this.exportService.exportExcel(name, columns, readings);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + (this.facade.animal()?.earTag ?? '')
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('monitoring.telemetry.title');
        await this.exportService.exportPdf(name, title, columns, readings, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private periodFor(preset: RangePreset): TelemetryPeriod | null {
    const now = new Date();
    if (preset !== 'custom') {
      const hours = preset === '24h' ? 24 : preset === '7d' ? 7 * 24 : 30 * 24;
      return { from: new Date(now.getTime() - hours * HOUR_MS), to: now };
    }
    const first = this.rangeForm.controls.from.value;
    const last = this.rangeForm.controls.to.value;
    if (!first || !last) return null;
    const from = startOfDay(first);
    const to = new Date(startOfDay(last).getTime() + DAY_MS);
    return from < to ? { from, to } : null;
  }

  private points(metric: 'bodyTemperature' | 'activityIndex'): ChartPoint[] {
    return this.facade.readings().map((reading: TelemetryReading) => ({
      x: new Date(reading.recordedAt),
      y: measurementValue(reading[metric]),
    }));
  }

  private metricLabel(metric: MonitoredMetric): string {
    this.language.current();
    return this.translate.instant('monitoring.metric.' + metric);
  }

  private bandOf(band: { readonly min: number; readonly max: number } | null): ChartBand | null {
    this.language.current();
    if (!band) return null;
    return {
      min: band.min,
      max: band.max,
      minLabel: this.translate.instant('monitoring.chart.minimum'),
      maxLabel: this.translate.instant('monitoring.chart.maximum'),
    };
  }

  private exportColumns(): ExportColumn<TelemetryReading>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('monitoring.fields.recordedAt'), value: reading => new Date(reading.recordedAt) },
      {
        header: text('monitoring.metric.BodyTemperature') + ' (' + text('monitoring.units.celsius') + ')',
        value: reading => measurementValue(reading.bodyTemperature),
      },
      { header: text('monitoring.metric.ActivityIndex'), value: reading => measurementValue(reading.activityIndex) },
      { header: text('monitoring.metric.RuminationMinutes'), value: reading => measurementValue(reading.ruminationMinutes) },
      { header: text('monitoring.metric.BatteryLevel'), value: reading => measurementValue(reading.batteryLevel) },
      {
        header: text('monitoring.fields.position'),
        value: reading => (reading.position.status === 'Valid'
          ? this.coordinates(reading.position.latitude, reading.position.longitude)
          : text('monitoring.measurement.' + reading.position.status)),
      },
    ];
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}
