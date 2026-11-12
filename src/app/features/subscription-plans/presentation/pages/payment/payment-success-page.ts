import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PlansFacade } from '../../../application/services/plans.facade';
import { SubscriptionFacade } from '../../../application/services/subscription.facade';
import { ReceiptDownload } from '../../receipt/receipt-download';

/** Waits for the activation that Stripe's confirmation triggers, then shows the plan or explains how to check it later. */
@Component({
  selector: 'ichu-payment-success-page',
  imports: [ApiErrorMessagePipe, Icon, LocalizedDatePipe, MatProgressBarModule, RouterLink, TranslatePipe],
  templateUrl: './payment-success-page.html',
  styleUrl: '../../styles/subscription-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReceiptDownload],
})
export class PaymentSuccessPage {
  readonly facade = inject(SubscriptionFacade);
  readonly plans = inject(PlansFacade);
  readonly receipt = inject(ReceiptDownload);
  private readonly router = inject(Router);
  /** The catalog entry of the activated subscription, which the receipt names. */
  readonly plan = computed(() => {
    const subscription = this.facade.subscription();
    return subscription ? this.plans.plans().find(candidate => candidate.id === subscription.planId) ?? null : null;
  });

  constructor() {
    // Stripe adds session_id on return; its value is never shown, and a visit without it is not a payment result.
    if (!inject(ActivatedRoute).snapshot.queryParamMap.has('session_id')) {
      void this.router.navigateByUrl('/subscriptions', { replaceUrl: true });
      return;
    }
    inject(DestroyRef).onDestroy(() => this.facade.stopActivationWatch());
    void this.plans.open({ tier: null, headCount: null });
    this.facade.watchActivation();
  }

  downloadReceipt(): void {
    const subscription = this.facade.subscription();
    const plan = this.plan();
    if (subscription && plan) void this.receipt.download(subscription, plan);
  }
}
