import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { EpidemiologicalCurveFacade } from '../../../application/services/epidemiological-curve.facade';
import { ExecutiveReportFacade } from '../../../application/services/executive-report.facade';
import { LotTrendsFacade } from '../../../application/services/lot-trends.facade';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod, addDays } from '../../../domain/model/analytics-period';
import { EpidemiologyTab } from '../../components/epidemiology-tab';
import { ExecutiveReportTab } from '../../components/executive-report-tab';
import { PeriodPicker } from '../../components/period-picker';
import { TrendsTab } from '../../components/trends-tab';

const TAB_NAMES = ['trends', 'epidemiology', 'executive'] as const;
type TabName = (typeof TAB_NAMES)[number];

/** Reads the `tab` query value, falling back to trends for unknown or missing values. */
function tabFromQuery(value: string | null): TabName {
  return TAB_NAMES.find(name => name === value) ?? 'trends';
}

/** The reports area: lot trends, the epidemiological curve, and the executive report, sharing one period. */
@Component({
  selector: 'ichu-reports-page',
  imports: [EpidemiologyTab, ExecutiveReportTab, MatTabsModule, PeriodPicker, TrendsTab, TranslatePipe],
  providers: [LotTrendsFacade, EpidemiologicalCurveFacade, ExecutiveReportFacade],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly tabIndex = computed(() => TAB_NAMES.indexOf(tabFromQuery(this.query().get('tab'))));
  readonly preferredCattleId = computed(() => this.query().get('cattle'));
  readonly periodLabel = computed(() => {
    const locale = formatLocaleTag(this.language.current());
    const period = this.period();
    return {
      from: formatDate(period.from, 'mediumDate', locale),
      to: formatDate(addDays(period.to, -1), 'mediumDate', locale),
    };
  });

  setPeriod(period: AnalyticsPeriod): void {
    this.period.set(period);
  }

  /** The chosen tab lives in the URL, so a link or a reload opens the same report. */
  selectTab(index: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: TAB_NAMES[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
