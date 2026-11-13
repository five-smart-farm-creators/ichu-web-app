import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { type ChartBand, type ChartSeries, LineChart } from '../../../../shared/presentation/charts/line-chart';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { LotTrendsFacade } from '../../application/services/lot-trends.facade';
import { type AnalyticsPeriod, localDayStart } from '../../domain/model/analytics-period';
import { TREND_METRICS } from '../../domain/model/lot-trend.model';
import { animalDailyMeans, dailyLotMeans } from '../../domain/model/trend-statistics';
import { formatAnalyticsNumber, formatSignedDifference } from '../analytics-format';
import { analyticsTextKey } from '../analytics-text';

/** Lot trends of one metric: the daily lot mean against the threshold band, the flagged animals, and one animal's comparison. */
@Component({
  selector: 'ichu-trends-tab',
  imports: [
    ApiErrorMessagePipe,
    LineChart,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trends-tab.html',
  styleUrl: './trends-tab.scss',
})
export class TrendsTab {
  readonly facade = inject(LotTrendsFacade);
  readonly context = inject(IamContextFacade);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly period = input.required<AnalyticsPeriod>();
  readonly preferredCattleId = input<string | null>(null);
  readonly metrics = TREND_METRICS;
  readonly showTable = signal(false);
  readonly draftMultiplier = signal<number | null>(null);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly dailyMeans = computed(() => dailyLotMeans(this.facade.series()?.points ?? []));
  readonly members = computed(() => (this.facade.selectedLot()?.cattleIds ?? [])
    .map(cattleId => ({ cattleId, earTag: this.facade.earTagById().get(cattleId) ?? null }))
    .filter((member): member is { cattleId: string; earTag: string } => member.earTag !== null)
    .sort((first, second) => first.earTag.localeCompare(second.earTag, undefined, { numeric: true })));

  /** The chart reads the language, so its legend and limits follow a language switch without a new read. */
  readonly chartSeries = computed<ChartSeries[]>(() => {
    const series = this.facade.series();
    this.language.current();
    if (!series) return [];
    const days = this.dailyMeans();
    const outliers = new Set(series.outlierAnimals);
    const result: ChartSeries[] = [{
      label: this.translate.instant('analytics.trends.chartLabel'),
      color: '--forest',
      points: days.map(day => ({ x: localDayStart(day.day), y: day.value })),
    }];
    if (series.lotAverage !== null && days.length > 0) {
      result.push({
        label: this.translate.instant('analytics.trends.averageLine'),
        color: '--accent',
        points: [
          { x: localDayStart(days[0].day), y: series.lotAverage },
          { x: localDayStart(days[days.length - 1].day), y: series.lotAverage },
        ],
      });
    }
    const flagged = animalDailyMeans(series.points).filter(item => outliers.has(item.cattleId));
    if (flagged.length > 0) {
      result.push({
        label: this.translate.instant('analytics.trends.outlierSeries'),
        color: '--warning',
        markersOnly: true,
        points: flagged.map(item => ({ x: localDayStart(item.day), y: item.value })),
      });
    }
    return result;
  });

  readonly band = computed<ChartBand | null>(() => {
    const average = this.facade.series()?.lotAverage ?? null;
    const threshold = this.facade.threshold();
    this.language.current();
    if (average === null || threshold === null) return null;
    return {
      min: average - threshold,
      max: average + threshold,
      minLabel: this.translate.instant('analytics.trends.lowerLimit'),
      maxLabel: this.translate.instant('analytics.trends.upperLimit'),
    };
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const period = this.period();
      const preferred = this.preferredCattleId();
      untracked(() => void this.facade.open(ranchId, period, preferred));
    });
  }

  displayedMultiplier(): number {
    return this.draftMultiplier() ?? this.facade.multiplier();
  }

  /** The slider previews the value while it moves and reads the series once the user releases it. */
  previewMultiplier(event: Event): void {
    this.draftMultiplier.set(Number((event.target as HTMLInputElement).value));
  }

  commitMultiplier(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.draftMultiplier.set(null);
    void this.facade.setMultiplier(value);
  }

  number(value: number | null, fractionDigits = 2): string {
    return formatAnalyticsNumber(value, this.dateLocale(), fractionDigits);
  }

  signed(value: number | null): string {
    return formatSignedDifference(value, this.dateLocale());
  }

  reasonKey(text: string | null): string {
    return analyticsTextKey(text ?? '');
  }

  dayDate(day: string): Date {
    return localDayStart(day);
  }

  /** Explains why the threshold is missing: it needs a spread, and a spread needs animals that differ. */
  thresholdNote(): string {
    const spread = this.facade.spread();
    if (spread === null) return 'analytics.trends.needTwoAnimals';
    return 'analytics.trends.noSpread';
  }
}
