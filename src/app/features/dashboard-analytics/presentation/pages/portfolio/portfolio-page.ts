import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { type ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { RanchPortfolioFacade } from '../../../application/services/ranch-portfolio.facade';
import type { RanchPortfolioEntry } from '../../../domain/model/ranch-portfolio.model';
import { formatAnalyticsNumber } from '../../analytics-format';

/** The ranches of a veterinarian ordered by the attention they need, with a way into each one's dashboard. */
@Component({
  selector: 'ichu-portfolio-page',
  imports: [ApiErrorMessagePipe, ExportMenu, LocalizedDatePipe, MatProgressBarModule, TranslatePipe],
  providers: [RanchPortfolioFacade],
  templateUrl: './portfolio-page.html',
  styleUrl: './portfolio-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioPage {
  readonly facade = inject(RanchPortfolioFacade);
  readonly context = inject(IamContextFacade);
  private readonly router = inject(Router);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));

  constructor() {
    void this.facade.load();
  }

  /** Names a ranch as the shell does: its name, or a numbered fallback that never shows the ID. */
  ranchLabel(ranchId: string): string {
    const ranches = this.context.ranches();
    const position = ranches.findIndex(access => access.ranchId === ranchId);
    if (position < 0) return this.translate.instant('analytics.portfolio.unnamedRanch');
    return ranches[position].name || this.translate.instant('shell.ranchFallback', { position: position + 1 });
  }

  count(value: number | null): string {
    return formatAnalyticsNumber(value, this.dateLocale(), 0);
  }

  /** Makes the ranch current and opens its dashboard, so the figures that follow belong to it. */
  open(ranchId: string): void {
    this.facade.open(ranchId);
    void this.router.navigateByUrl('/dashboard');
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.facade.entries();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-portfolio', columns, rows);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.portfolio');
        await this.exportService.exportPdf('ichu-portfolio', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(): ExportColumn<RanchPortfolioEntry>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('analytics.portfolio.ranch'), value: row => this.ranchLabel(row.ranchId) },
      { header: text('analytics.portfolio.critical'), value: row => row.criticalAlerts },
      { header: text('analytics.portfolio.warning'), value: row => row.warningAlerts },
      { header: text('analytics.portfolio.informative'), value: row => row.informativeAlerts },
      { header: text('analytics.portfolio.unresponsive'), value: row => row.unresponsiveTreatmentAnimals },
      { header: text('analytics.portfolio.overdue'), value: row => row.overdueCampaigns },
      { header: text('analytics.portfolio.updated'), value: row => new Date(row.updatedAt) },
    ];
  }
}
