import type { Money, PlanFeature } from './plan.model';

/** Lifecycle of a subscription; only a pending one can be paid, and a pending or active one can be cancelled. */
export type SubscriptionStatus = 'Pending' | 'Active' | 'Cancelled' | 'Expired';

/** A pending subscription gets a quote; one that was paid, now or before it ended, gets a receipt. */
export type ReceiptKind = 'receipt' | 'quote';

/** Source recorded when the visitor did not arrive from a link that names one. */
export const DEFAULT_ACQUISITION_SOURCE = 'web-app';
/** The API stores the acquisition source in a column of this length. */
const MAX_ACQUISITION_SOURCE_LENGTH = 64;
/** The API stores the cancellation reason with this limit. */
export const MAX_CANCELLATION_REASON_LENGTH = 200;

export interface Subscription {
  readonly id: string;
  readonly ranchId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly headCount: number;
  readonly annualFee: Money;
  /** Sent by the API once it prices each collar; older responses omit it and the unit price is derived. */
  readonly deviceUnitPrice?: Money;
  readonly devicesCost: Money;
  readonly total: Money;
  readonly termsVersion: string;
  readonly requestedAt: string;
  readonly activatedAt: string | null;
  readonly validUntil: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly maximumDevices: number;
  readonly features: readonly PlanFeature[];
}

/** The quote the ranch manager accepts; `expectedTotal` lets the API refuse a quote that has since changed. */
export interface RequestSubscription {
  readonly planId: string;
  readonly headCount: number;
  readonly expectedTotal: number;
  readonly termsVersion: string;
  readonly operationId: string;
  readonly acquisitionSource: string;
}

export interface CheckoutSession {
  readonly sessionId: string;
  readonly url: string;
  readonly expiresAt: string;
}

export function canPayNow(status: SubscriptionStatus): boolean {
  return status === 'Pending';
}

export function canCancelSubscription(status: SubscriptionStatus): boolean {
  return status === 'Pending' || status === 'Active';
}

/** A ranch holds one open subscription at a time, so a pending or active one blocks a new request. */
export function isOpenSubscription(status: SubscriptionStatus): boolean {
  return status === 'Pending' || status === 'Active';
}

/** A pending subscription has a quote; a subscription paid at any time since has a receipt. */
export function receiptKindOf(subscription: Pick<Subscription, 'status' | 'activatedAt'>): ReceiptKind | null {
  if (subscription.status === 'Pending') return 'quote';
  return subscription.status === 'Active' || subscription.activatedAt !== null ? 'receipt' : null;
}

export function isValidCancellationReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= 1 && length <= MAX_CANCELLATION_REASON_LENGTH;
}

/** Only a ranch manager with Manage scope requests, pays, or cancels; other roles read the plans and the subscription. */
export function canManageSubscription(access: { readonly role: string | null; readonly scope: string | null }): boolean {
  return access.role === 'RanchManager' && access.scope === 'Manage';
}

/** Keeps a source that fits the API's column; anything else falls back to the web app source. */
export function acquisitionSourceOf(value: string | null): string {
  const source = value?.trim() ?? '';
  return source !== '' && source.length <= MAX_ACQUISITION_SOURCE_LENGTH ? source : DEFAULT_ACQUISITION_SOURCE;
}
