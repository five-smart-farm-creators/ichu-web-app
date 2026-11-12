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
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PlanningCampaignsFacade } from '../../../application/services/planning-campaigns.facade';
import { type CampaignStatus, campaignStatus, type PlanningCampaign } from '../../../domain/model/planning-campaign.model';
import { localDay, parseLocalDay } from '../../../domain/model/planning-time';
import { CampaignDetailDialog } from '../../components/campaign-detail-dialog';
import { CreateCampaignDialog } from '../../components/create-campaign-dialog';
import { PLANNING_DIALOG_CONFIG, PLANNING_WIDE_DIALOG_CONFIG } from '../../components/planning-dialog';

const STATUS_TONE: Readonly<Record<CampaignStatus, string>> = { Upcoming: 'neutral', Active: 'success', Finished: 'neutral' };

/** Lists the campaigns of the ranch; a managing account creates them, and each opens its activities. */
@Component({
  selector: 'ichu-planning-campaigns-page',
  imports: [ApiErrorMessagePipe, ExportMenu, Icon, LocalizedDatePipe, MatProgressBarModule, MatTableModule, TranslatePipe],
  providers: [PlanningCampaignsFacade],
  templateUrl: './planning-campaigns-page.html',
  styleUrl: './planning-campaigns-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningCampaignsPage {
  readonly facade = inject(PlanningCampaignsFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly displayedColumns = ['name', 'kind', 'status', 'startsOn', 'endsOn'];
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
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

  statusOf(campaign: PlanningCampaign): CampaignStatus {
    return campaignStatus(campaign, localDay(new Date()));
  }

  statusTone(campaign: PlanningCampaign): string {
    return STATUS_TONE[this.statusOf(campaign)];
  }

  openCreate(): void {
    this.dialog.open(CreateCampaignDialog, { ...PLANNING_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome === 'saved') this.notice.set('planning.campaigns.created');
      });
  }

  openDetail(campaign: PlanningCampaign): void {
    const ranchId = this.context.currentRanchId();
    if (!ranchId) return;
    this.dialog.open(CampaignDetailDialog, {
      ...PLANNING_WIDE_DIALOG_CONFIG,
      injector: this.injector,
      data: { ranchId, campaign, canManage: this.canManage(), canRecordClinical: this.canRecordClinical() },
    });
  }

  dateOf(day: string): Date {
    return parseLocalDay(day);
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const campaigns = this.facade.rows();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-campaigns', columns, campaigns);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.planningCampaigns');
        await this.exportService.exportPdf('ichu-campaigns', title, columns, campaigns, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(): ExportColumn<PlanningCampaign>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('planning.fields.name'), value: campaign => campaign.name },
      { header: text('planning.fields.kind'), value: campaign => text('planning.kind.' + campaign.kind) },
      { header: text('planning.fields.status'), value: campaign => text('planning.campaignStatus.' + this.statusOf(campaign)) },
      { header: text('planning.fields.startsOn'), value: campaign => parseLocalDay(campaign.startsOn) },
      { header: text('planning.fields.endsOn'), value: campaign => parseLocalDay(campaign.endsOn) },
    ];
  }
}
