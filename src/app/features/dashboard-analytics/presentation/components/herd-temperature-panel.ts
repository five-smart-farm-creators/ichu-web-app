import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import {
  type ChartArea, type ChartLimit, type ChartSeries, LineChart,
} from '../../../../shared/presentation/charts/line-chart';
import { PluralPipe } from '../../../../shared/presentation/plural.pipe';
import { HerdDashboardFacade } from '../../application/services/herd-dashboard.facade';
import { localDayStart } from '../../domain/model/analytics-period';
import { formatAnalyticsNumber } from '../analytics-format';
import { analyticsTextKey } from '../analytics-text';

/** Local noon keeps each day's point inside that day on the time axis, whatever the offset. */
function localNoon(day: string): Date {
  const noon = localDayStart(day);
  noon.setHours(12);
  return noon;
}

/** The chosen lot's body temperature day by day: the daily mean, its ±1σ band and the alert threshold. */
@Component({
  selector: 'ichu-herd-temperature-panel',
  imports: [ApiErrorMessagePipe, LineChart, MatFormFieldModule, MatProgressBarModule, MatSelectModule, PluralPipe, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './herd-temperature-panel.html',
  styleUrl: './herd-temperature-panel.scss',
})
export class HerdTemperaturePanel {
  readonly facade = inject(HerdDashboardFacade);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  readonly locale = computed(() => formatLocaleTag(this.language.current()));
  readonly latest = computed(() => this.facade.temperature().at(-1) ?? null);
  readonly latestMean = computed(() => {
    const latest = this.latest();
    return latest ? formatAnalyticsNumber(latest.mean, this.locale(), 1) : '';
  });
  readonly selectedLot = computed(() => this.facade.temperatureLots().find(lot => lot.lotId === this.facade.temperatureLotId()) ?? null);
  readonly unitLabel = computed(() => {
    const unit = this.facade.temperatureUnit();
    this.language.current();
    return unit ? this.translate.instant(`analytics.units.${unit}`) : '';
  });

  /** The chart reads the language, so its legend and labels follow a language switch without a new read. */
  readonly chartSeries = computed<ChartSeries[]>(() => {
    const bands = this.facade.temperature();
    this.language.current();
    return [{
      label: this.translate.instant('analytics.dashboard.temperature.series'),
      color: '--forest',
      points: bands.map(band => ({ x: localNoon(band.day), y: band.mean })),
    }];
  });

  /** A day with one animal has no spread, so its band edges stay gaps instead of collapsing onto the mean. */
  readonly chartArea = computed<ChartArea | null>(() => {
    const bands = this.facade.temperature();
    this.language.current();
    if (bands.length === 0) return null;
    return {
      label: this.translate.instant('analytics.dashboard.temperature.band'),
      color: '--green-soft',
      lower: bands.map(band => ({ x: localNoon(band.day), y: band.spread === null ? null : band.mean - band.spread })),
      upper: bands.map(band => ({ x: localNoon(band.day), y: band.spread === null ? null : band.mean + band.spread })),
    };
  });

  readonly chartLimit = computed<ChartLimit | null>(() => {
    const limit = this.facade.temperatureLimit();
    const unit = this.unitLabel();
    this.language.current();
    if (limit === null) return null;
    return {
      value: limit,
      label: this.translate.instant('analytics.dashboard.temperature.limit', {
        value: formatAnalyticsNumber(limit, this.locale(), 1),
        unit,
      }),
    };
  });

  reasonKey(reason: string): string {
    return analyticsTextKey(reason);
  }

  selectLot(lotId: string): void {
    void this.facade.selectTemperatureLot(lotId);
  }
}
