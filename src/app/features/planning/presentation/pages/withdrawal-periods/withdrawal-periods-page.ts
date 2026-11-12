import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
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
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { WithdrawalPeriodsFacade } from '../../../application/services/withdrawal-periods.facade';
import {
  withdrawalProgress, type WithdrawalPeriod, type WithdrawalProgress, type WithdrawalState,
} from '../../../domain/model/withdrawal-period.model';
import { PLANNING_DIALOG_CONFIG } from '../../components/planning-dialog';
import { WithdrawalPeriodDialog } from '../../components/withdrawal-period-dialog';

const STATE_TONE: Readonly<Record<WithdrawalState, string>> = { Active: 'success', Upcoming: 'neutral', Ended: 'neutral' };

/** Lists the withdrawal periods of the ranch, narrowed by animal; a clinical account records them with both bounds. */
@Component({
  selector: 'ichu-withdrawal-periods-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    TranslatePipe,
  ],
  providers: [WithdrawalPeriodsFacade],
  templateUrl: './withdrawal-periods-page.html',
  styleUrl: './withdrawal-periods-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WithdrawalPeriodsPage {
  readonly facade = inject(WithdrawalPeriodsFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly displayedColumns = ['animal', 'startsAt', 'endsAt', 'state', 'daysRemaining'];
  readonly canRecordClinical = computed(() => ['ClinicalWrite', 'Manage'].includes(this.context.currentRanch()?.scope ?? ''));
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

  progressOf(period: WithdrawalPeriod): WithdrawalProgress {
    return withdrawalProgress(period, new Date());
  }

  toneOf(period: WithdrawalPeriod): string {
    return STATE_TONE[this.progressOf(period).state];
  }

  earTag(cattleId: string): string {
    return this.facade.animals().find(animal => animal.cattleId === cattleId)?.earTag ?? '';
  }

  dateOf(instant: string): Date {
    return new Date(instant);
  }

  filterByAnimal(cattleId: string): void {
    void this.facade.filterByCattle(cattleId || null);
  }

  openRecord(): void {
    const ranchId = this.context.currentRanchId();
    if (!ranchId) return;
    this.dialog.open(WithdrawalPeriodDialog, { ...PLANNING_DIALOG_CONFIG, injector: this.injector, data: { ranchId } })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome === 'saved') this.notice.set('planning.withdrawal.recorded');
      });
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const periods = this.facade.rows();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-withdrawal-periods', columns, periods);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.withdrawalPeriods');
        await this.exportService.exportPdf('ichu-withdrawal-periods', title, columns, periods, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(): ExportColumn<WithdrawalPeriod>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('planning.fields.animal'), value: period => this.earTag(period.cattleId) },
      { header: text('planning.fields.startsAt'), value: period => new Date(period.startsAt) },
      { header: text('planning.fields.endsAt'), value: period => new Date(period.endsAt) },
      { header: text('planning.fields.state'), value: period => text('planning.withdrawalState.' + this.progressOf(period).state) },
      { header: text('planning.withdrawal.remaining'), value: period => this.progressOf(period).daysRemaining },
    ];
  }
}
