import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import {
  ClinicalHistoryFacade, HISTORY_PERIODS, type HistoryPeriod,
} from '../../../application/services/clinical-history.facade';
import { type LivestockOperation, OPERATION_TYPES } from '../../../domain/model/livestock-operation.model';
import { IndicatorValue } from '../../components/indicator-value';
import { MONITORING_DIALOG_CONFIG, type MonitoringDialogOutcome } from '../../components/monitoring-dialog';
import { RecordOperationDialog } from '../../components/record-operation-dialog';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';

/** An animal's field events and clinical interventions, newest first, with its health summary and registrations. */
@Component({
  selector: 'ichu-clinical-history-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    IndicatorValue,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [ClinicalHistoryFacade],
  templateUrl: './clinical-history-page.html',
  styleUrl: './clinical-history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalHistoryPage {
  readonly facade = inject(ClinicalHistoryFacade);
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly periods = HISTORY_PERIODS;
  readonly types = OPERATION_TYPES;
  readonly routeCattleId = toSignal(this.route.paramMap.pipe(map(params => params.get('cattleId'))), { initialValue: null });
  readonly canRecordField = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly canRecordClinical = computed(() => ['ClinicalWrite', 'Manage'].includes(this.context.currentRanch()?.scope ?? ''));
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly notice = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const cattleId = this.routeCattleId();
      untracked(() => {
        this.notice.set(null);
        void this.facade.open(ranchId, cattleId);
      });
    });
  }

  chooseAnimal(cattleId: string): void {
    void this.facade.selectAnimal(cattleId || null);
  }

  choosePeriod(period: HistoryPeriod): void {
    void this.facade.setPeriod(period);
  }

  chooseType(value: string): void {
    this.facade.setTypeFilter(OPERATION_TYPES.find(type => type === value) ?? null);
  }

  openRecord(kind: 'field' | 'clinical'): void {
    const animal = this.facade.animal();
    if (!animal) return;
    this.dialog.open(RecordOperationDialog, { ...MONITORING_DIALOG_CONFIG, injector: this.injector, data: { kind, animal } })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, kind));
  }

  async export(format: ExportFormat): Promise<void> {
    const animal = this.facade.animal();
    const window = this.facade.window();
    if (!animal || !window) return;
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.facade.timeline();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-clinical-history', columns, rows);
      } else {
        const locale = this.dateLocale();
        const details = this.translate.instant('health.report.subtitle', {
          earTag: animal.earTag,
          stage: this.translate.instant('cattle.stage.' + animal.lifeStage),
          from: formatDate(window.from, 'mediumDate', locale),
          to: formatDate(new Date(), 'mediumDate', locale),
        });
        const subtitle = currentRanchLabel(this.context, this.translate) + ' · ' + details;
        const title = 'ICHU · ' + this.translate.instant('pages.clinicalHistory');
        await this.exportService.exportPdf('ichu-clinical-history', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private showOutcome(outcome: MonitoringDialogOutcome | undefined, kind: 'field' | 'clinical'): void {
    if (outcome !== 'saved') return;
    this.notice.set(kind === 'field' ? 'health.records.fieldSaved' : 'health.records.clinicalSaved');
  }

  private exportColumns(): ExportColumn<LivestockOperation>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('health.fields.occurredAt'), value: operation => new Date(operation.occurredAt) },
      { header: text('health.fields.type'), value: operation => text('health.type.' + operation.type) },
      { header: text('health.fields.kind'), value: operation => text(operation.isClinical ? 'health.kind.clinical' : 'health.kind.field') },
      { header: text('health.fields.product'), value: operation => operation.product },
      { header: text('health.fields.dose'), value: operation => operation.dose },
      { header: text('health.fields.observation'), value: operation => operation.observation },
    ];
  }
}
