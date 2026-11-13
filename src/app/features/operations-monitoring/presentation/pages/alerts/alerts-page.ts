import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { AlertsFacade } from '../../../application/services/alerts.facade';
import { GeofencesFacade } from '../../../application/services/geofences.facade';
import { ALERT_STATUSES, type Alert, type AlertSeverity, type AlertStatus } from '../../../domain/model/alert.model';
import type { Geofence } from '../../../domain/model/geofence.model';
import { ALERT_DRAWER_CONFIG, type MonitoringDialogOutcome } from '../../components/monitoring-dialog';
import { type AlertDialogData, AlertDetailDialog } from '../../components/alert-detail-dialog';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';
import { formatMeasure } from '../../monitoring-format';

const SEVERITY_TONE: Readonly<Record<AlertSeverity, string>> = { Informative: 'neutral', Warning: 'warning', Critical: 'danger' };
const STATUS_TONE: Readonly<Record<AlertStatus, string>> = { Pending: 'warning', Acknowledged: 'success' };

/** Lists the alerts of the ranch with status and animal filters; each alert opens a drawer where it can be attended. */
@Component({
  selector: 'ichu-alerts-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    TranslatePipe,
  ],
  providers: [AlertsFacade, GeofencesFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './alerts-page.html',
  styleUrl: './alerts-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPage {
  readonly facade = inject(AlertsFacade);
  readonly geofences = inject(GeofencesFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly statuses = ALERT_STATUSES;
  readonly pageSizeOptions = [10, 25, 50];
  readonly displayedColumns = ['raisedAt', 'animal', 'type', 'severity', 'status', 'value', 'actions'];
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly notice = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.notice.set(null);
        this.conflict.set(false);
        void this.facade.open(ranchId);
        void this.geofences.open(ranchId);
      });
    });
  }

  filterByStatus(value: string): void {
    void this.facade.search({ status: (value || null) as AlertStatus | null, cattleId: this.facade.filter().cattleId });
  }

  filterByAnimal(value: string): void {
    void this.facade.search({ status: this.facade.filter().status, cattleId: value || null });
  }

  onPage(event: PageEvent): void {
    void this.facade.goToPage(event.pageIndex, event.pageSize);
  }

  severityTone(severity: AlertSeverity): string {
    return SEVERITY_TONE[severity];
  }

  statusTone(status: AlertStatus): string {
    return STATUS_TONE[status];
  }

  /** Threshold alerts show the value that was read; geofence alerts show how far outside the boundary it was. */
  valueText(alert: Alert): string {
    const value = alert.type === 'Geofence' ? alert.distanceToBoundaryMeters : alert.detectedValue;
    return formatMeasure(value, this.dateLocale(), alert.type === 'Geofence' ? 0 : 1);
  }

  openAlert(alert: Alert): void {
    const data: AlertDialogData = {
      alert,
      earTag: this.facade.earTag(alert.cattleId),
      geofence: this.geofenceOf(alert),
      canManage: this.canManage(),
    };
    this.dialog.open(AlertDetailDialog, { ...ALERT_DRAWER_CONFIG, injector: this.injector, data })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome));
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    this.notice.set(null);
    try {
      const alerts = await this.facade.exportRows();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-alerts', columns, alerts);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.alerts');
        await this.exportService.exportPdf('ichu-alerts', title, columns, alerts, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private geofenceOf(alert: Alert): Geofence | null {
    if (!alert.geofenceId) return null;
    return this.geofences.geofences().find(geofence => geofence.geofenceId === alert.geofenceId) ?? null;
  }

  private showOutcome(outcome: MonitoringDialogOutcome | undefined): void {
    if (outcome === 'saved') {
      this.conflict.set(false);
      this.notice.set('monitoring.alerts.acknowledged');
    } else if (outcome === 'conflict') {
      this.notice.set(null);
      this.conflict.set(true);
    }
  }

  private exportColumns(): ExportColumn<Alert>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('monitoring.fields.raisedAt'), value: alert => new Date(alert.raisedAt) },
      { header: text('cattle.fields.earTag'), value: alert => this.facade.earTag(alert.cattleId) },
      { header: text('monitoring.fields.type'), value: alert => text('monitoring.alertType.' + alert.type) },
      { header: text('monitoring.fields.severity'), value: alert => text('monitoring.severity.' + alert.severity) },
      { header: text('monitoring.fields.status'), value: alert => text('monitoring.alertStatus.' + alert.status) },
      { header: text('monitoring.fields.detectedValue'), value: alert => alert.detectedValue },
      { header: text('monitoring.fields.distanceToBoundary'), value: alert => alert.distanceToBoundaryMeters },
      { header: text('monitoring.fields.finding'), value: alert => alert.finding },
      { header: text('monitoring.fields.action'), value: alert => alert.action },
      { header: text('monitoring.fields.responseTimeSeconds'), value: alert => alert.responseTimeSeconds },
    ];
  }
}
