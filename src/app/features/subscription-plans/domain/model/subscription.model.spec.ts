import {
  acquisitionSourceOf,
  canCancelSubscription,
  canManageSubscription,
  canPayNow,
  isOpenSubscription,
  isValidCancellationReason,
  receiptKindOf,
} from './subscription.model';

describe('subscription model', () => {
  it('lets only a pending subscription be paid', () => {
    expect(canPayNow('Pending')).toBe(true);
    expect(canPayNow('Active')).toBe(false);
  });

  it('lets a pending or active subscription be cancelled', () => {
    expect(canCancelSubscription('Pending')).toBe(true);
    expect(canCancelSubscription('Active')).toBe(true);
    expect(canCancelSubscription('Cancelled')).toBe(false);
    expect(canCancelSubscription('Expired')).toBe(false);
  });

  it('treats a pending or active subscription as open, which blocks a second request', () => {
    expect(isOpenSubscription('Pending')).toBe(true);
    expect(isOpenSubscription('Active')).toBe(true);
    expect(isOpenSubscription('Cancelled')).toBe(false);
    expect(isOpenSubscription('Expired')).toBe(false);
  });

  it('offers a quote while pending and a receipt once the subscription was paid', () => {
    expect(receiptKindOf({ status: 'Pending', activatedAt: null })).toBe('quote');
    expect(receiptKindOf({ status: 'Active', activatedAt: '2026-11-11T10:05:00' })).toBe('receipt');
    expect(receiptKindOf({ status: 'Expired', activatedAt: '2026-01-01T10:00:00' })).toBe('receipt');
    expect(receiptKindOf({ status: 'Cancelled', activatedAt: null })).toBeNull();
  });

  it('requires a trimmed reason of 1 to 200 characters', () => {
    expect(isValidCancellationReason('   ')).toBe(false);
    expect(isValidCancellationReason('Sold the herd')).toBe(true);
    expect(isValidCancellationReason('x'.repeat(200))).toBe(true);
    expect(isValidCancellationReason('x'.repeat(201))).toBe(false);
  });

  it('lets only a ranch manager with Manage scope subscribe', () => {
    expect(canManageSubscription({ role: 'RanchManager', scope: 'Manage' })).toBe(true);
    expect(canManageSubscription({ role: 'RanchManager', scope: 'Read' })).toBe(false);
    expect(canManageSubscription({ role: 'Veterinarian', scope: 'Manage' })).toBe(false);
    expect(canManageSubscription({ role: null, scope: null })).toBe(false);
  });

  it('keeps a source that fits the API column and falls back otherwise', () => {
    expect(acquisitionSourceOf(' landing-hero ')).toBe('landing-hero');
    expect(acquisitionSourceOf(null)).toBe('web-app');
    expect(acquisitionSourceOf('   ')).toBe('web-app');
    expect(acquisitionSourceOf('s'.repeat(64))).toBe('s'.repeat(64));
    expect(acquisitionSourceOf('s'.repeat(65))).toBe('web-app');
  });
});
