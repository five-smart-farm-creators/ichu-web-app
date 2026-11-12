import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { TERMS_VERSION } from '../../../../core/layout/terms';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import {
  canCancelSubscription,
  canPayNow,
  isValidCancellationReason,
  type RequestSubscription,
  type Subscription,
} from '../../domain/model/subscription.model';
import { CheckoutLocation } from '../../domain/repositories/checkout-location';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';

/** Stripe's confirmation usually arrives within seconds; the check runs every 3 s for at most a minute. */
const ACTIVATION_POLL_MS = 3000;
const ACTIVATION_TIMEOUT_MS = 60000;

export interface SubscriptionRequestInput {
  readonly planId: string;
  readonly headCount: number;
  readonly expectedTotal: number;
  readonly operationId: string;
  readonly acquisitionSource: string;
}

export type ActivationState = 'waiting' | 'active' | 'timed-out';

/** Requests, pays, cancels, and follows the subscription of the ranch in scope; the API decides every amount and state. */
@Injectable()
export class SubscriptionFacade {
  private readonly repository = inject(SubscriptionRepository);
  private readonly checkout = inject(CheckoutLocation);
  private readonly context = inject(IamContextFacade);
  private loadRequest = 0;
  private activationWatch = 0;
  private activationTimer: ReturnType<typeof setTimeout> | null = null;

  readonly subscription = signal<Subscription | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly notice = signal<'cancelled' | null>(null);
  readonly activation = signal<ActivationState | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopActivationWatch());
  }

  /** Reads the pending or active subscription of the ranch in scope; a ranch without one simply has none. */
  async load(): Promise<void> {
    const ranchId = this.context.currentRanchId();
    const request = ++this.loadRequest;
    this.subscription.set(null);
    this.notice.set(null);
    this.error.set(null);
    if (!ranchId) return;
    this.loading.set(true);
    try {
      const current = await this.repository.current(ranchId);
      if (request === this.loadRequest) this.subscription.set(current);
    } catch (error) {
      if (request === this.loadRequest) this.error.set(toApiError(error));
    } finally {
      if (request === this.loadRequest) this.loading.set(false);
    }
  }

  /** Requests the subscription at the quoted total, then opens its payment page; the operation identifier makes a retry safe. */
  async requestAndPay(input: SubscriptionRequestInput): Promise<boolean> {
    const ranchId = this.context.currentRanchId();
    if (this.busy()) return false;
    if (!ranchId) {
      this.error.set(new ApiError(0, 'configuration', null));
      return false;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const request: RequestSubscription = { ...input, termsVersion: TERMS_VERSION };
      const subscription = await this.repository.request(ranchId, request);
      this.subscription.set(subscription);
      await this.openCheckout(ranchId, subscription.id);
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Opens the payment page of the pending subscription again, for a retry after a cancelled payment. */
  async payPending(): Promise<boolean> {
    const ranchId = this.context.currentRanchId();
    const subscription = this.subscription();
    if (this.busy() || !ranchId || !subscription || !canPayNow(subscription.status)) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.openCheckout(ranchId, subscription.id);
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Cancels the loaded pending or active subscription; the reason is trimmed and must fit the API's limit. */
  async cancel(reason: string): Promise<boolean> {
    const ranchId = this.context.currentRanchId();
    const subscription = this.subscription();
    if (this.busy() || !ranchId || !subscription || !canCancelSubscription(subscription.status)
      || !isValidCancellationReason(reason)) {
      return false;
    }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      this.subscription.set(await this.repository.cancel(ranchId, subscription.id, reason.trim()));
      this.notice.set('cancelled');
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Polls the subscription until the confirmed payment activates it, then gives up so the visitor can check My plan. */
  watchActivation(): void {
    this.stopActivationWatch();
    const ranchId = this.context.currentRanchId();
    if (!ranchId) return;
    const watch = this.activationWatch;
    const startedAt = Date.now();
    this.activation.set('waiting');
    const poll = async (): Promise<void> => {
      this.activationTimer = null;
      let current: Subscription | null = null;
      try {
        current = await this.repository.current(ranchId);
      } catch {
        // A failed check waits for the next poll; the timeout decides when to stop.
      }
      if (watch !== this.activationWatch) return;
      if (current) this.subscription.set(current);
      if (current?.status === 'Active') {
        this.activation.set('active');
      } else if (Date.now() - startedAt >= ACTIVATION_TIMEOUT_MS) {
        this.activation.set('timed-out');
      } else {
        this.activationTimer = setTimeout(() => void poll(), ACTIVATION_POLL_MS);
      }
    };
    void poll();
  }

  /** Stops the activation polling, which the success page calls when the visitor leaves it. */
  stopActivationWatch(): void {
    this.activationWatch++;
    if (this.activationTimer === null) return;
    clearTimeout(this.activationTimer);
    this.activationTimer = null;
  }

  private async openCheckout(ranchId: string, subscriptionId: string): Promise<void> {
    const session = await this.repository.startCheckout(ranchId, subscriptionId);
    this.checkout.assign(session.url);
  }
}
