import type { CheckoutSession, RequestSubscription, Subscription } from '../model/subscription.model';

/** Reads, requests, opens the payment of, and cancels the subscription of one ranch. */
export abstract class SubscriptionRepository {
  /** Resolves to null when the ranch has no pending or active subscription. */
  abstract current(ranchId: string): Promise<Subscription | null>;
  abstract request(ranchId: string, request: RequestSubscription): Promise<Subscription>;
  abstract startCheckout(ranchId: string, subscriptionId: string): Promise<CheckoutSession>;
  abstract cancel(ranchId: string, subscriptionId: string, reason: string): Promise<Subscription>;
}
