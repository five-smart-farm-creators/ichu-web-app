import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PlansFacade } from '../../../application/services/plans.facade';
import { SubscriptionFacade } from '../../../application/services/subscription.facade';
import {
  canCancelSubscription,
  canManageSubscription,
  canPayNow,
  receiptKindOf,
  type SubscriptionStatus,
} from '../../../domain/model/subscription.model';
import { CancelSubscriptionDialog } from '../../components/cancel-subscription-dialog';
import { PriceBreakdown } from '../../components/price-breakdown';
import { SUBSCRIPTION_DIALOG_CONFIG } from '../../components/subscription-dialog';
import { ReceiptDownload } from '../../receipt/receipt-download';

const STATUS_TONES: Readonly<Record<SubscriptionStatus, string>> = {
  Pending: 'warning',
  Active: 'success',
  Cancelled: 'neutral',
  Expired: 'danger',
};

/** Shows the ranch's subscription with the amounts agreed for it; a manager pays a pending one or cancels an open one. */
@Component({
  selector: 'ichu-my-plan-page',
  imports: [
    ApiErrorMessagePipe,
    Icon,
    LocalizedDatePipe,
    MatProgressBarModule,
    PriceBreakdown,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './my-plan-page.html',
  styleUrl: '../../styles/subscription-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ReceiptDownload],
})
export class MyPlanPage {
  readonly facade = inject(SubscriptionFacade);
  readonly plans = inject(PlansFacade);
  readonly receipt = inject(ReceiptDownload);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  readonly canPayNow = canPayNow;
  readonly canCancelSubscription = canCancelSubscription;
  readonly canManage = computed(() => canManageSubscription({
    role: this.context.currentRole(),
    scope: this.context.currentRanch()?.scope ?? null,
  }));
  /** The catalog entry of the loaded subscription; it names the plan on the screen and in the document. */
  readonly plan = computed(() => {
    const subscription = this.facade.subscription();
    return subscription ? this.plans.plans().find(candidate => candidate.id === subscription.planId) ?? null : null;
  });
  readonly documentKind = computed(() => {
    const subscription = this.facade.subscription();
    return subscription ? receiptKindOf(subscription) : null;
  });

  constructor() {
    effect(() => {
      this.context.currentRanchId();
      untracked(() => void this.facade.load());
    });
    void this.plans.open({ tier: null, headCount: null });
  }

  statusTone(status: SubscriptionStatus): string {
    return STATUS_TONES[status];
  }

  pay(): void {
    void this.facade.payPending();
  }

  openCancel(): void {
    this.dialog.open(CancelSubscriptionDialog, { ...SUBSCRIPTION_DIALOG_CONFIG, injector: this.injector });
  }

  downloadDocument(): void {
    const subscription = this.facade.subscription();
    const plan = this.plan();
    if (subscription && plan) void this.receipt.download(subscription, plan);
  }
}
