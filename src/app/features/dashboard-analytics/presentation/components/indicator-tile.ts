import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { PluralPipe } from '../../../../shared/presentation/plural.pipe';
import { type IndicatorValue, isIndicatorAvailable } from '../../domain/model/herd-indicators.model';
import { formatAnalyticsNumber } from '../analytics-format';
import { analyticsTextKey } from '../analytics-text';

let nextTileId = 0;

/** One indicator with its unit, or "Not available" with its reason; a toggle reveals the calculation. */
@Component({
  selector: 'ichu-indicator-tile',
  imports: [PluralPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="stat indicator-tile">
      <span class="stat-label">{{ label() | translate }}</span>
      @if (available()) {
        <span class="stat-value">{{ number() }} <span class="unit">{{ 'analytics.units.' + indicator().unit | plural: (indicator().value ?? 0) }}</span></span>
      } @else {
        <span class="stat-value unavailable">{{ 'analytics.notAvailable' | translate }}</span>
        <span class="stat-note">{{ reasonKey() | translate }}</span>
      }
      <ng-content />
      <button type="button" class="formula-toggle" [attr.aria-expanded]="showFormula()" [attr.aria-controls]="formulaId"
        (click)="showFormula.set(!showFormula())">
        {{ (showFormula() ? 'analytics.hideFormula' : 'analytics.showFormula') | translate }}
      </button>
      @if (showFormula()) {
        <div class="formula" [id]="formulaId">
          <p>{{ formulaKey() | translate }}</p>
          @if (indicator().denominator !== null) {
            <p class="stat-note">{{ 'analytics.denominator' | translate: { count: indicator().denominator } }}</p>
          }
        </div>
      }
    </article>`,
  styles: `.indicator-tile{display:flex;flex-direction:column;gap:4px}
    .unit{font-size:.8125rem;font-weight:600;color:var(--muted)}
    .unavailable{font-size:1.25rem;color:var(--muted)}
    .formula-toggle{align-self:flex-start;margin-top:10px;padding:0;border:0;background:none;color:var(--forest);font-size:.75rem;font-weight:650;text-decoration:underline}
    .formula{margin-top:6px;padding:10px 12px;border-radius:8px;background:var(--surface-2);font-size:.8125rem}
    .formula p{margin:0}`,
})
export class IndicatorTile {
  private readonly language = inject(LanguageService);
  readonly formulaId = `indicator-formula-${nextTileId++}`;
  readonly label = input.required<string>();
  readonly indicator = input.required<IndicatorValue>();
  readonly fractionDigits = input(1);
  readonly showFormula = signal(false);
  readonly available = computed(() => isIndicatorAvailable(this.indicator()));
  readonly number = computed(() => formatAnalyticsNumber(
    this.indicator().value,
    formatLocaleTag(this.language.current()),
    this.fractionDigits(),
  ));
  readonly reasonKey = computed(() => analyticsTextKey(this.indicator().unavailableReason ?? ''));
  readonly formulaKey = computed(() => analyticsTextKey(this.indicator().formula));
}
