import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlanTier } from '../../domain/model/plan.model';
import { type PricedPurchase, priceLines } from '../../domain/model/price-breakdown.model';
import { LocalizedMoneyPipe } from '../localized-money.pipe';

/** Lists the smart collars and the annual fee of a purchase, then its total; every amount is the one the API sent. */
@Component({
  selector: 'ichu-price-breakdown',
  imports: [LocalizedMoneyPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ul class="price-lines">
      @for (line of lines(); track line.kind) {
        <li>
          @if (line.kind === 'collars') {
            <span>{{ 'pricing.collarsLine' | translate: { count: line.quantity, unitPrice: (line.unitPrice | localizedMoney) } }}</span>
          } @else if (planTier(); as tier) {
            <span>{{ 'pricing.annualFeeLine' | translate: { plan: (('plans.tiers.' + tier) | translate) } }}</span>
          } @else {
            <span>{{ 'plans.annualFee' | translate }}</span>
          }
          <strong>{{ line.amount | localizedMoney }}</strong>
        </li>
      }
    </ul>
    <p class="price-total">
      <span>{{ 'plans.total' | translate }}</span>
      <strong>{{ priced().total | localizedMoney }}</strong>
    </p>`,
  styleUrl: '../styles/subscription-pages.scss',
})
export class PriceBreakdown {
  readonly priced = input.required<PricedPurchase>();
  readonly planTier = input<PlanTier | null>(null);
  readonly lines = computed(() => priceLines(this.priced()));
}
