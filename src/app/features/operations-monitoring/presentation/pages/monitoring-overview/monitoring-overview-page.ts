import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { HERD_LATEST_LIMIT, HerdMonitoringFacade, type HerdRow } from '../../../application/services/herd-monitoring.facade';
import { indicatorState } from '../../../domain/model/telemetry.model';
import { IndicatorValue } from '../../components/indicator-value';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';

/** Shows the latest values of each active animal; a missing or stale value is labelled, never shown as zero. */
@Component({
  selector: 'ichu-monitoring-overview-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    IndicatorValue,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [HerdMonitoringFacade],
  templateUrl: './monitoring-overview-page.html',
  styleUrl: './monitoring-overview-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringOverviewPage {
  readonly facade = inject(HerdMonitoringFacade);
  readonly context = inject(IamContextFacade);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly herdLimit = HERD_LATEST_LIMIT;
  readonly displayedColumns = ['earTag', 'stage', 'temperature', 'activity', 'rumination', 'lastReading', 'status'];
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => void this.facade.open(ranchId));
    });
  }

  selectLot(lotId: string): void {
    void this.facade.selectLot(lotId || null);
  }

  /** The status says what the latest values are, so an animal with stale or no values never looks current. */
  status(row: HerdRow): { readonly key: string; readonly tone: string } {
    if (row.failed || !row.latest) return { key: 'monitoring.overview.status.failed', tone: 'danger' };
    const states = [row.latest.bodyTemperature, row.latest.activityIndex, row.latest.ruminationMinutes].map(indicatorState);
    if (states.every(state => state === 'unavailable')) return { key: 'monitoring.overview.status.noReading', tone: 'neutral' };
    if (states.includes('stale')) return { key: 'monitoring.overview.status.stale', tone: 'warning' };
    return { key: 'monitoring.overview.status.current', tone: 'success' };
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.facade.rows();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-monitoring', columns, rows);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.monitoring');
        await this.exportService.exportPdf('ichu-monitoring', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(): ExportColumn<HerdRow>[] {
    const text = (key: string): string => this.translate.instant(key);
    const celsius = ' (' + text('monitoring.units.celsius') + ')';
    return [
      { header: text('cattle.fields.earTag'), value: row => row.animal.earTag },
      { header: text('cattle.fields.stage'), value: row => text('cattle.stage.' + row.animal.lifeStage) },
      { header: text('monitoring.metric.BodyTemperature') + celsius, value: row => row.latest?.bodyTemperature.value ?? null },
      { header: text('monitoring.metric.ActivityIndex'), value: row => row.latest?.activityIndex.value ?? null },
      { header: text('monitoring.metric.RuminationMinutes'), value: row => row.latest?.ruminationMinutes.value ?? null },
      { header: text('monitoring.fields.lastReading'), value: row => (row.latest?.lastReadingRecordedAt ? new Date(row.latest.lastReadingRecordedAt) : null) },
      { header: text('monitoring.fields.status'), value: row => text(this.status(row).key) },
    ];
  }
}
