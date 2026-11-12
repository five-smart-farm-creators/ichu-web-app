import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { saveBlob } from '../../../../shared/presentation/export/save-blob';
import { TableExportService } from '../../../../shared/presentation/export/table-export.service';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { ExecutiveReportFacade } from '../../application/services/executive-report.facade';
import { addDays, type AnalyticsPeriod, localDay } from '../../domain/model/analytics-period';
import { type IndicatorValue, isIndicatorAvailable } from '../../domain/model/herd-indicators.model';
import { formatAnalyticsNumber } from '../analytics-format';
import { analyticsTextKey } from '../analytics-text';
import { indicatorExportColumns, indicatorRows } from '../indicator-export';

type Download = 'csv' | 'pdf' | 'excel';

/** The executive report of a period: an on-screen preview of its indicators and the three downloads. */
@Component({
  selector: 'ichu-executive-report-tab',
  imports: [ApiErrorMessagePipe, LocalizedDatePipe, MatProgressBarModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './executive-report-tab.html',
  styleUrl: './executive-report-tab.scss',
})
export class ExecutiveReportTab {
  readonly facade = inject(ExecutiveReportFacade);
  readonly context = inject(IamContextFacade);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly period = input.required<AnalyticsPeriod>();
  readonly busy = signal<Download | null>(null);
  readonly downloadError = signal<ApiError | null>(null);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly rows = computed(() => {
    const document = this.facade.preview();
    return document ? indicatorRows(document.indicators) : [];
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const period = this.period();
      untracked(() => void this.facade.open(ranchId, period));
    });
  }

  /** The CSV keeps the server's file name when the browser can read it, and otherwise names the file by its days. */
  async downloadCsv(): Promise<void> {
    await this.run('csv', async () => {
      const file = await this.facade.csv();
      saveBlob(file.content, this.defaultCsvName());
    });
  }

  async exportDocument(format: 'pdf' | 'excel'): Promise<void> {
    await this.run(format, async () => {
      const report = await this.facade.document();
      const rows = indicatorRows(report.indicators);
      const columns = indicatorExportColumns(this.translate);
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-executive-report', columns, rows);
        return;
      }
      const dates = this.dates();
      const subtitle = currentRanchLabel(this.context, this.translate)
        + ' · ' + dates.from + ' – ' + dates.to
        + ' · ' + this.translate.instant('analytics.executive.generated', {
          date: formatDate(report.generatedAt, 'short', this.dateLocale()),
        });
      const title = 'ICHU · ' + this.translate.instant('analytics.executive.title');
      await this.exportService.exportPdf('ichu-executive-report', title, columns, rows, subtitle);
    });
  }

  number(value: number | null): string {
    return formatAnalyticsNumber(value, this.dateLocale(), 2);
  }

  isAvailable(indicator: IndicatorValue): boolean {
    return isIndicatorAvailable(indicator);
  }

  reasonKey(text: string | null): string {
    return analyticsTextKey(text ?? '');
  }

  dates(): { readonly from: string; readonly to: string } {
    const locale = this.dateLocale();
    const period = this.period();
    return {
      from: formatDate(period.from, 'mediumDate', locale),
      to: formatDate(addDays(period.to, -1), 'mediumDate', locale),
    };
  }

  private async run(download: Download, action: () => Promise<void>): Promise<void> {
    this.busy.set(download);
    this.downloadError.set(null);
    try {
      await action();
    } catch (error) {
      this.downloadError.set(toApiError(error));
    } finally {
      this.busy.set(null);
    }
  }

  private defaultCsvName(): string {
    const period = this.period();
    return `ichu-executive-report-${localDay(period.from)}-${localDay(addDays(period.to, -1))}.csv`;
  }
}
