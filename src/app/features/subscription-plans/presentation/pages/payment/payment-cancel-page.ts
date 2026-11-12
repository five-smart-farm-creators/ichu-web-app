import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { SubscriptionFacade } from '../../../application/services/subscription.facade';
import { canManageSubscription, canPayNow } from '../../../domain/model/subscription.model';

/** Explains that nothing was charged and offers to open the payment page of the pending subscription again. */
@Component({
  selector: 'ichu-payment-cancel-page',
  imports: [ApiErrorMessagePipe, RouterLink, TranslatePipe],
  templateUrl: './payment-cancel-page.html',
  styleUrl: '../../styles/subscription-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCancelPage {
  readonly facade = inject(SubscriptionFacade);
  readonly context = inject(IamContextFacade);
  readonly canRetry = computed(() => {
    const subscription = this.facade.subscription();
    return canManageSubscription({ role: this.context.currentRole(), scope: this.context.currentRanch()?.scope ?? null })
      && subscription !== null && canPayNow(subscription.status);
  });

  constructor() {
    effect(() => {
      this.context.currentRanchId();
      untracked(() => void this.facade.load());
    });
  }

  retry(): void {
    void this.facade.payPending();
  }
}
