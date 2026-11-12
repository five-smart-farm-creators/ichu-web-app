import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { indicatorState, type LatestIndicator } from '../../domain/model/telemetry.model';
import { formatMeasure } from '../monitoring-format';

/** Shows a latest value with its unit; a stale value is marked, and a missing value is never shown as zero. */
@Component({
  selector: 'ichu-indicator-value',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (state() === 'unavailable') {
      <span class="text-muted">{{ 'monitoring.state.noReading' | translate }}</span>
    } @else {
      <span class="indicator-number">{{ number() }} {{ ('monitoring.units.' + indicator().unit) | translate }}</span>
      @if (state() === 'stale') {
        <span class="badge warning">{{ 'monitoring.state.stale' | translate }}</span>
      }
    }`,
  styles: '.indicator-number{font-weight:650;font-variant-numeric:tabular-nums}.badge{margin-left:6px}',
})
export class IndicatorValue {
  private readonly language = inject(LanguageService);
  readonly indicator = input.required<LatestIndicator>();
  readonly state = computed(() => indicatorState(this.indicator()));
  readonly number = computed(() => formatMeasure(this.indicator().value, formatLocaleTag(this.language.current())));
}
