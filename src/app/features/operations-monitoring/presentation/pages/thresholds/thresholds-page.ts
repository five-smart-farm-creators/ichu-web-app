import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { MonitoringThresholdsFacade } from '../../../application/services/monitoring-thresholds.facade';
import type { AlertSeverity } from '../../../domain/model/alert.model';
import type { MonitoringThreshold } from '../../../domain/model/monitoring-threshold.model';
import { MONITORING_DIALOG_CONFIG, type MonitoringDialogOutcome } from '../../components/monitoring-dialog';
import { ThresholdDialog } from '../../components/threshold-dialog';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';

const SEVERITY_TONE: Readonly<Record<AlertSeverity, string>> = { Informative: 'neutral', Warning: 'warning', Critical: 'danger' };

/** Lists the normal ranges of each stage and metric; a managing account configures them. */
@Component({
  selector: 'ichu-thresholds-page',
  imports: [ApiErrorMessagePipe, ExportMenu, Icon, MatProgressBarModule, MatTableModule, TranslatePipe],
  providers: [MonitoringThresholdsFacade],
  templateUrl: './thresholds-page.html',
  styleUrl: './thresholds-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThresholdsPage {
  readonly facade = inject(MonitoringThresholdsFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly displayedColumns = ['stage', 'metric', 'minimum', 'maximum', 'severity', 'actions'];
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly notice = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.notice.set(null);
        void this.facade.open(ranchId);
      });
    });
  }

  severityTone(severity: AlertSeverity): string {
    return SEVERITY_TONE[severity];
  }

  openEditor(threshold: MonitoringThreshold | null): void {
    this.dialog.open(ThresholdDialog, { ...MONITORING_DIALOG_CONFIG, injector: this.injector, data: threshold })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome));
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.facade.thresholds();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-thresholds', columns, rows);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.thresholds');
        await this.exportService.exportPdf('ichu-thresholds', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private showOutcome(outcome: MonitoringDialogOutcome | undefined): void {
    if (outcome === 'saved') {
      this.notice.set('monitoring.thresholds.saved');
    } else if (outcome === 'conflict') {
      this.notice.set('monitoring.errors.versionConflict');
      void this.facade.open(this.context.currentRanchId());
    }
  }

  private exportColumns(): ExportColumn<MonitoringThreshold>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('monitoring.fields.lifeStage'), value: threshold => text('cattle.stage.' + threshold.lifeStage) },
      { header: text('monitoring.fields.metric'), value: threshold => text('monitoring.metric.' + threshold.metric) },
      { header: text('monitoring.fields.minValue'), value: threshold => threshold.minValue },
      { header: text('monitoring.fields.maxValue'), value: threshold => threshold.maxValue },
      { header: text('monitoring.fields.severity'), value: threshold => text('monitoring.severity.' + threshold.severity) },
    ];
  }
}
