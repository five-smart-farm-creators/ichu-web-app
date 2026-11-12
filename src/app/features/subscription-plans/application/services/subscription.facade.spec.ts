import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import type { Subscription } from '../../domain/model/subscription.model';
import { CheckoutLocation } from '../../domain/repositories/checkout-location';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';
import { SubscriptionFacade } from './subscription.facade';

const ranchId = 'ranch-1';
const checkoutUrl = 'https://checkout.example.test/session';

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'subscription-1',
    ranchId,
    planId: 'standard',
    status: 'Pending',
    headCount: 120,
    annualFee: { amount: 1800, currency: 'PEN' },
    devicesCost: { amount: 14400, currency: 'PEN' },
    total: { amount: 16200, currency: 'PEN' },
    termsVersion: '2026-11',
    requestedAt: '2026-11-11T10:00:00Z',
    activatedAt: null,
    validUntil: null,
    cancelledAt: null,
    cancellationReason: null,
    maximumDevices: 200,
    features: ['Monitoring'],
    ...overrides,
  };
}

const request = { planId: 'standard', headCount: 120, expectedTotal: 16200, operationId: 'operation-1', acquisitionSource: 'landing' };

describe('SubscriptionFacade', () => {
  let facade: SubscriptionFacade;
  let repository: {
    current: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    startCheckout: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let location: { assign: ReturnType<typeof vi.fn> };
  let context: { currentRanchId: WritableSignal<string | null> };

  beforeEach(() => {
    vi.useFakeTimers();
    repository = {
      current: vi.fn(async () => subscription()),
      request: vi.fn(async () => subscription()),
      startCheckout: vi.fn(async () => ({ sessionId: 'cs_example_1', url: checkoutUrl, expiresAt: '2026-11-11T11:00:00Z' })),
      cancel: vi.fn(async () => subscription({ status: 'Cancelled', cancelledAt: '2026-11-11T12:00:00Z', cancellationReason: 'Sold the herd' })),
    };
    location = { assign: vi.fn() };
    context = { currentRanchId: signal<string | null>(ranchId) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SubscriptionFacade,
        { provide: SubscriptionRepository, useValue: repository },
        { provide: CheckoutLocation, useValue: location },
        { provide: IamContextFacade, useValue: context },
      ],
    });
    facade = TestBed.inject(SubscriptionFacade);
  });

  afterEach(() => {
    facade.stopActivationWatch();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('requests the subscription with the terms version, then redirects to its payment page', async () => {
    expect(await facade.requestAndPay(request)).toBe(true);

    expect(repository.request).toHaveBeenCalledWith(ranchId, { ...request, termsVersion: '2026-11' });
    expect(repository.startCheckout).toHaveBeenCalledWith(ranchId, 'subscription-1');
    expect(location.assign).toHaveBeenCalledWith(checkoutUrl);
    expect(repository.request.mock.invocationCallOrder[0]).toBeLessThan(repository.startCheckout.mock.invocationCallOrder[0]);
  });

  it('retries with the same operation identifier after the payment page could not open', async () => {
    repository.startCheckout.mockRejectedValueOnce(new ApiError(503, 'SubscriptionPlans.PaymentProviderUnavailable', 'The payment provider is unavailable.'));

    expect(await facade.requestAndPay(request)).toBe(false);
    expect(facade.error()).toMatchObject({ status: 503 });
    expect(location.assign).not.toHaveBeenCalled();

    expect(await facade.requestAndPay(request)).toBe(true);
    expect(repository.request.mock.calls.map(call => call[1].operationId)).toEqual(['operation-1', 'operation-1']);
    expect(location.assign).toHaveBeenCalledTimes(1);
    expect(facade.error()).toBeNull();
  });

  it('keeps the API error of a changed quote and does not redirect', async () => {
    repository.request.mockRejectedValueOnce(new ApiError(409, 'SubscriptionPlans.QuoteChanged', 'The price changed. Review the new quote.'));

    expect(await facade.requestAndPay(request)).toBe(false);

    expect(facade.error()).toMatchObject({ status: 409, title: 'The price changed. Review the new quote.' });
    expect(repository.startCheckout).not.toHaveBeenCalled();
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('loads the subscription of the ranch and treats a missing one as none', async () => {
    await facade.load();

    expect(repository.current).toHaveBeenCalledWith(ranchId);
    expect(facade.subscription()?.id).toBe('subscription-1');

    repository.current.mockResolvedValueOnce(null);
    await facade.load();

    expect(facade.subscription()).toBeNull();
    expect(facade.error()).toBeNull();
  });

  it('opens the payment page again only for a pending subscription', async () => {
    await facade.load();

    expect(await facade.payPending()).toBe(true);
    expect(location.assign).toHaveBeenCalledWith(checkoutUrl);

    repository.current.mockResolvedValueOnce(subscription({ status: 'Active' }));
    await facade.load();

    expect(await facade.payPending()).toBe(false);
    expect(location.assign).toHaveBeenCalledTimes(1);
  });

  it('cancels with the trimmed reason and refuses an already cancelled subscription', async () => {
    await facade.load();

    expect(await facade.cancel('  Sold the herd  ')).toBe(true);

    expect(repository.cancel).toHaveBeenCalledWith(ranchId, 'subscription-1', 'Sold the herd');
    expect(facade.subscription()?.status).toBe('Cancelled');
    expect(facade.notice()).toBe('cancelled');
    expect(await facade.cancel('Again')).toBe(false);
    expect(repository.cancel).toHaveBeenCalledTimes(1);
  });

  it('refuses a blank or oversized cancellation reason', async () => {
    await facade.load();

    expect(await facade.cancel('   ')).toBe(false);
    expect(await facade.cancel('x'.repeat(201))).toBe(false);
    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it('polls every three seconds until the subscription is active', async () => {
    repository.current
      .mockResolvedValueOnce(subscription())
      .mockResolvedValueOnce(subscription())
      .mockResolvedValueOnce(subscription({ status: 'Active', activatedAt: '2026-11-11T10:05:00Z', validUntil: '2027-11-11T10:05:00Z' }));

    facade.watchActivation();
    await vi.advanceTimersByTimeAsync(3000);
    expect(facade.activation()).toBe('waiting');
    await vi.advanceTimersByTimeAsync(3000);

    expect(repository.current).toHaveBeenCalledTimes(3);
    expect(facade.activation()).toBe('active');
    expect(facade.subscription()?.status).toBe('Active');

    await vi.advanceTimersByTimeAsync(9000);
    expect(repository.current).toHaveBeenCalledTimes(3);
  });

  it('stops after a minute and reports that activation takes longer', async () => {
    facade.watchActivation();
    await vi.advanceTimersByTimeAsync(60000);

    expect(facade.activation()).toBe('timed-out');
    const checks = repository.current.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(repository.current.mock.calls.length).toBe(checks);
  });

  it('stops polling when the visitor leaves the success page', async () => {
    facade.watchActivation();
    await vi.advanceTimersByTimeAsync(0);

    facade.stopActivationWatch();
    const checks = repository.current.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);

    expect(repository.current.mock.calls.length).toBe(checks);
  });
});
