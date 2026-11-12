import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { Icon } from '../../../../../shared/presentation/icon';
import { PlansFacade } from '../../../application/services/plans.facade';
import { SubscriptionFacade } from '../../../application/services/subscription.facade';
import {
  headCountOf,
  MAX_HEAD_COUNT,
  MIN_HEAD_COUNT,
  PLAN_FEATURES,
  type Plan,
  type PlanFeature,
  planTierOf,
} from '../../../domain/model/plan.model';
import { acquisitionSourceOf, canManageSubscription, isOpenSubscription } from '../../../domain/model/subscription.model';
import { PriceBreakdown } from '../../components/price-breakdown';
import { SubscribeDialog } from '../../components/subscribe-dialog';
import { SUBSCRIPTION_DIALOG_CONFIG } from '../../components/subscription-dialog';
import { LocalizedMoneyPipe } from '../../localized-money.pipe';

/** Compares the plans for the number of collars the visitor enters; a ranch manager opens the confirmation from a plan card. */
@Component({
  selector: 'ichu-plans-page',
  imports: [
    ApiErrorMessagePipe,
    Icon,
    LocalizedMoneyPipe,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    PriceBreakdown,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './plans-page.html',
  styleUrl: '../../styles/subscription-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlansPage {
  readonly plans = inject(PlansFacade);
  readonly context = inject(IamContextFacade);
  readonly subscriptions = inject(SubscriptionFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly acquisitionSource: string;
  readonly features = PLAN_FEATURES;
  readonly canSubscribe = computed(() => canManageSubscription({
    role: this.context.currentRole(),
    scope: this.context.currentRanch()?.scope ?? null,
  }));
  /** The ranch's pending or active subscription, which blocks a second request. */
  readonly openSubscription = computed(() => {
    const subscription = this.subscriptions.subscription();
    return subscription && isOpenSubscription(subscription.status) ? subscription : null;
  });
  readonly openPlan = computed(() => {
    const subscription = this.openSubscription();
    return subscription ? this.plans.plans().find(plan => plan.id === subscription.planId) ?? null : null;
  });
  readonly headCountControl = new FormControl<number | null>(null, {
    validators: [
      Validators.required,
      Validators.min(MIN_HEAD_COUNT),
      Validators.max(MAX_HEAD_COUNT),
      Validators.pattern(/^\d+$/),
    ],
  });

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    const headCount = headCountOf(query.get('headCount'));
    this.acquisitionSource = acquisitionSourceOf(query.get('source'));
    this.headCountControl.setValue(headCount, { emitEvent: false });
    this.headCountControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.plans.setHeadCount(this.headCountControl.valid ? this.headCountControl.value : null));
    void this.plans.open({ tier: planTierOf(query.get('tier')), headCount });
    effect(() => {
      this.context.currentRanchId();
      untracked(() => void this.subscriptions.load());
    });
  }

  isSelected(plan: Plan): boolean {
    return this.plans.selectedTier() === plan.tier;
  }

  isRecommended(plan: Plan): boolean {
    return this.plans.recommended()?.id === plan.id;
  }

  includes(plan: Plan, feature: PlanFeature): boolean {
    return plan.features.includes(feature);
  }

  openSubscribe(planId: string): void {
    if (this.openSubscription()) return;
    this.dialog.open(SubscribeDialog, {
      ...SUBSCRIPTION_DIALOG_CONFIG,
      injector: this.injector,
      data: { planId, acquisitionSource: this.acquisitionSource },
    });
  }
}
