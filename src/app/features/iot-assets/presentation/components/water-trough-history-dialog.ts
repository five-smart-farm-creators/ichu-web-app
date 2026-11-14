import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { ChartBand, ChartSeries, LineChart } from '../../../../shared/presentation/charts/line-chart';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import type { WaterReadingSummary } from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { WaterTroughsFacade } from '../../application/services/water-troughs.facade';
import type { WaterTrough } from '../../domain/model/water-trough.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES } from './iot-dialog';

/** The trough whose history opens, and the controller that recorded its readings. */
interface WaterTroughHistoryData {
  readonly trough: WaterTrough;
  readonly controllerId: string;
}

/** Charts the readings of the last 24 hours against the trough band and lists them in a table. */
@Component({
  selector: 'ichu-water-trough-history-dialog',
  imports: [ApiErrorMessagePipe, DecimalPipe, LineChart, LocalizedDatePipe, MatDialogModule, MatProgressBarModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'waterTroughs.status.history.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dialog-lead">{{ 'waterTroughs.status.history.lead' | translate }}</p>
      <p class="device-serial"><strong>{{ 'waterTroughs.fields.name' | translate }}:</strong> {{ data.trough.name }}</p>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'waterTroughs.status.history.loading' | translate" />
      }
      @if (error(); as apiError) {
        <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
      } @else if (!loading()) {
        @if (truncated()) {
          <p class="notice" role="status">
            {{ 'waterTroughs.status.history.truncated' | translate: { shown: readings().length, total: totalCount() } }}
          </p>
        }
        @if (readings().length === 0) {
          <p class="text-muted">{{ 'waterTroughs.status.history.empty' | translate }}</p>
        } @else {
          <ichu-line-chart [series]="series()" [band]="band()" [yAxisLabel]="'monitoring.units.celsius' | translate"
            [accessibleLabel]="'waterTroughs.status.history.chart' | translate" />
          <div class="table-scroll">
            <table class="data-table" [attr.aria-label]="'waterTroughs.status.history.title' | translate">
              <thead>
                <tr>
                  <th scope="col">{{ 'waterTroughs.status.fields.capturedAt' | translate }}</th>
                  <th scope="col">{{ 'waterTroughs.status.fields.waterTemperature' | translate }}</th>
                  <th scope="col">{{ 'waterTroughs.status.fields.measurement' | translate }}</th>
                  <th scope="col">{{ 'waterTroughs.status.fields.heater' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (reading of readings(); track $index) {
                  <tr>
                    <td>{{ reading.capturedAt | localizedDate: 'short' }}</td>
                    <td>
                      @if (reading.temperature !== null) {
                        {{ reading.temperature | number: '1.0-1' : dateLocale }} {{ 'monitoring.units.celsius' | translate }}
                      } @else {
                        <span class="text-muted">–</span>
                      }
                    </td>
                    <td>{{ ('waterTroughs.status.measurement.' + (reading.isValid ? 'Valid' : 'Invalid')) | translate }}</td>
                    <td>{{ ('waterTroughs.status.heater.' + reading.heaterState) | translate }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>`,
  styles: IOT_DIALOG_STYLES,
})
export class WaterTroughHistoryDialog {
  private readonly facade = inject(WaterTroughsFacade);
  readonly data = inject<WaterTroughHistoryData>(MAT_DIALOG_DATA);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly dateLocale = formatLocaleTag(this.language.current());
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly readings = signal<readonly WaterReadingSummary[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly truncated = computed(() => this.totalCount() > this.readings().length);
  readonly series = computed<ChartSeries[]>(() => [{
    label: this.text('waterTroughs.status.fields.waterTemperature'),
    color: '--forest',
    points: this.readings().map(reading => ({ x: new Date(reading.capturedAt), y: reading.temperature })),
  }]);
  readonly band = computed<ChartBand | null>(() => {
    const range = this.data.trough.temperatureRange;
    if (!range) return null;
    return {
      min: range.minimumCelsius,
      max: range.maximumCelsius,
      minLabel: this.text('waterTroughs.fields.minimum'),
      maxLabel: this.text('waterTroughs.fields.maximum'),
    };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const summary = await this.facade.readingsOf(this.data.controllerId);
      this.readings.set(summary.items);
      this.totalCount.set(summary.totalCount);
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Reads the language signal so labels built inside computed values follow a language switch. */
  private text(key: string): string {
    this.language.current();
    return this.translate.instant(key);
  }
}
