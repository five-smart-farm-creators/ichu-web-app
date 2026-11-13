import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { HerdDashboardFacade } from '../../../application/services/herd-dashboard.facade';
import { type AnalyticsPeriod, addDays } from '../../../domain/model/analytics-period';
import { orderedAlertTypes } from '../../../domain/model/herd-indicators.model';
import { analyticsTextKey } from '../../analytics-text';
import { HerdTemperaturePanel } from '../../components/herd-temperature-panel';
import { IndicatorTile, type StatTone } from '../../components/indicator-tile';
import { PeriodPicker } from '../../components/period-picker';
import { RecentAlertsPanel } from '../../components/recent-alerts-panel';
import { indicatorExportColumns, indicatorRows } from '../../indicator-export';

/** The herd at a glance: the indicators of a period, the temperature of a lot, recent alerts and collars, and downloads. */
@Component({
  selector: 'ichu-herd-dashboard-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    HerdTemperaturePanel,
    Icon,
    IndicatorTile,
    LocalizedDatePipe,
    MatProgressBarModule,
    PeriodPicker,
    RecentAlertsPanel,
    RouterLink,
    TranslatePipe,
  ],
  providers: [HerdDashboardFacade],
  templateUrl: './herd-dashboard-page.html',
  styleUrl: './herd-dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HerdDashboardPage {
  readonly facade = inject(HerdDashboardFacade);
  readonly context = inject(IamContextFacade);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly openingCount = signal(0);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  /** The facade has no loading signal for alerts and collars, so the page reports the opens still in flight. */
  readonly alertsLoading = computed(() => this.openingCount() > 0);
  readonly openAlertTotal = computed<number | null>(() => {
    const counts = this.facade.report()?.openAlertsByType;
    return counts ? Object.values(counts).reduce((total, count) => total + count, 0) : null;
  });
  readonly alertBreakdown = computed(() => {
    const counts = this.facade.report()?.openAlertsByType;
    if (!counts) return [];
    return orderedAlertTypes(counts)
      .map(type => ({ type, count: counts[type] }))
      .filter(item => item.count > 0);
  });
  readonly alertTone = computed<StatTone>(() => ((this.openAlertTotal() ?? 0) > 0 ? 'danger' : 'neutral'));
  readonly geofenceTone = computed<StatTone>(() => ((this.facade.report()?.outsideGeofenceAnimals.value ?? 0) > 0 ? 'warning' : 'neutral'));
  readonly periodLabel = computed(() => this.periodDates(this.facade.period()));
  readonly updatedText = computed(() => {
    const updatedAt = this.facade.report()?.updatedAt;
    return updatedAt ? formatDate(updatedAt, 'short', this.dateLocale()) : '';
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => void this.openDashboard(ranchId));
    });
  }

  setPeriod(period: AnalyticsPeriod): void {
    void this.facade.setPeriod(period);
  }

  reasonKey(reason: string | null): string {
    return analyticsTextKey(reason ?? '');
  }

  async export(format: ExportFormat): Promise<void> {
    const report = this.facade.report();
    if (!report) return;
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = indicatorRows(report);
      const columns = indicatorExportColumns(this.translate);
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-dashboard', columns, rows);
      } else {
        const period = this.periodLabel();
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + period.from + ' – ' + period.to;
        const title = 'ICHU · ' + this.translate.instant('pages.dashboard');
        await this.exportService.exportPdf('ichu-dashboard', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private async openDashboard(ranchId: string | null): Promise<void> {
    this.openingCount.update(count => count + 1);
    try {
      await this.facade.open(ranchId, this.facade.period());
    } finally {
      this.openingCount.update(count => count - 1);
    }
  }

  /** The window ends before its exclusive end, so the last shown day is the day before it. */
  private periodDates(period: AnalyticsPeriod): { readonly from: string; readonly to: string } {
    const locale = this.dateLocale();
    return {
      from: formatDate(period.from, 'mediumDate', locale),
      to: formatDate(addDays(period.to, -1), 'mediumDate', locale),
    };
  }
}
