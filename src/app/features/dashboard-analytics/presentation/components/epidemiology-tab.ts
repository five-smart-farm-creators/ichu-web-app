import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { BarChart, type BarChartSeries } from '../../../../shared/presentation/charts/bar-chart';
import { type ChartSeries, LineChart } from '../../../../shared/presentation/charts/line-chart';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { PluralPipe } from '../../../../shared/presentation/plural.pipe';
import { EpidemiologicalCurveFacade, ROLLING_WINDOW_DAYS } from '../../application/services/epidemiological-curve.facade';
import { type AnalyticsPeriod, localDayStart } from '../../domain/model/analytics-period';
import { CURVE_CONDITIONS, type CurveCondition } from '../../domain/model/epidemiological-curve.model';
import { formatAnalyticsNumber } from '../analytics-format';
import { analyticsTextKey } from '../analytics-text';

/** The daily progression of one condition: new cases with their moving average, the running total, and the restriction hint. */
@Component({
  selector: 'ichu-epidemiology-tab',
  imports: [
    ApiErrorMessagePipe,
    BarChart,
    LineChart,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    PluralPipe,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epidemiology-tab.html',
  styleUrl: './epidemiology-tab.scss',
})
export class EpidemiologyTab {
  readonly facade = inject(EpidemiologicalCurveFacade);
  readonly context = inject(IamContextFacade);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly period = input.required<AnalyticsPeriod>();
  readonly conditions = CURVE_CONDITIONS;
  readonly showTable = signal(false);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));

  /** Day labels are calendar days, so they are formatted in the reader's language and never shifted by a time zone. */
  readonly dayLabels = computed(() => this.facade.days().map(day =>
    formatDate(localDayStart(day.day), 'd MMM', this.dateLocale())));
  readonly peakLabel = computed(() => {
    const peak = this.facade.peak();
    return peak ? formatDate(localDayStart(peak.day), 'mediumDate', this.dateLocale()) : '';
  });

  readonly barSeries = computed<BarChartSeries[]>(() => {
    const days = this.facade.days();
    this.language.current();
    return [
      {
        label: this.translate.instant('analytics.epidemiology.newCases'),
        color: '--danger',
        kind: 'bar',
        values: days.map(day => day.cases),
      },
      {
        label: this.translate.instant('analytics.epidemiology.rollingAverage', { days: ROLLING_WINDOW_DAYS }),
        color: '--forest',
        kind: 'line',
        values: this.facade.rollingAverage(),
      },
    ];
  });

  readonly cumulativeSeries = computed<ChartSeries[]>(() => {
    const days = this.facade.days();
    const running = this.facade.cumulative();
    this.language.current();
    return [{
      label: this.translate.instant('analytics.epidemiology.cumulative'),
      color: '--accent',
      points: days.map((day, index) => ({ x: localDayStart(day.day), y: running[index] })),
    }];
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const period = this.period();
      untracked(() => void this.facade.open(ranchId, period));
    });
  }

  selectCondition(condition: CurveCondition): void {
    void this.facade.setCondition(condition);
  }

  number(value: number | null, fractionDigits = 1): string {
    return formatAnalyticsNumber(value, this.dateLocale(), fractionDigits);
  }

  reasonKey(text: string | null): string {
    return analyticsTextKey(text ?? '');
  }

  /** The restriction hint compares the days without cases with the incubation period; without that answer, the reason is shown. */
  restrictionKey(): string {
    const curve = this.facade.curve();
    if (!curve) return '';
    if (curve.supportsRestrictionLifting === true) return 'analytics.epidemiology.restrictionYes';
    if (curve.supportsRestrictionLifting === false) return 'analytics.epidemiology.restrictionNo';
    return curve.unavailableReason ? this.reasonKey(curve.unavailableReason) : 'analytics.notAvailable';
  }
}
