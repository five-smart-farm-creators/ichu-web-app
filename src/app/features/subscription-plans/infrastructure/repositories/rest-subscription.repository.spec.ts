import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { RestSubscriptionRepository } from './rest-subscription.repository';

const subscriptionsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/subscriptions';
const pending = {
  id: 'subscription-1',
  ranchId: 'ranch-1',
  planId: 'plan-2',
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
};
const requestBody = {
  planId: 'plan-2',
  headCount: 120,
  expectedTotal: 16200,
  termsVersion: '2026-11',
  operationId: 'operation-1',
  acquisitionSource: 'landing',
};

describe('RestSubscriptionRepository', () => {
  let http: HttpTestingController;
  let repository: RestSubscriptionRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestSubscriptionRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestSubscriptionRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the pending or active subscription of the ranch', async () => {
    const result = repository.current('ranch-1');
    const request = http.expectOne(subscriptionsUrl);

    expect(request.request.method).toBe('GET');
    request.flush(pending);
    expect(await result).toEqual(pending);
  });

  it('reports a ranch without a subscription as null', async () => {
    const result = repository.current('ranch-1');
    http.expectOne(subscriptionsUrl).flush(
      { status: 404, title: 'The ranch has no subscription.', code: 'SubscriptionPlans.SubscriptionNotFound' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(await result).toBeNull();
  });

  it('requests a subscription with the accepted quote and the operation identifier', async () => {
    const result = repository.request('ranch-1', requestBody);
    const request = http.expectOne(subscriptionsUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush(pending, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(pending);
  });

  it('starts the checkout of a pending subscription', async () => {
    const session = { sessionId: 'cs_example_1', url: 'https://checkout.example.test/session', expiresAt: '2026-11-11T11:00:00Z' };
    const result = repository.startCheckout('ranch-1', 'subscription-1');
    const request = http.expectOne(`${subscriptionsUrl}/subscription-1/checkout-sessions`);

    expect(request.request.method).toBe('POST');
    request.flush(session, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(session);
  });

  it('cancels a subscription with its reason', async () => {
    const result = repository.cancel('ranch-1', 'subscription-1', 'Sold the herd');
    const request = http.expectOne(`${subscriptionsUrl}/subscription-1/cancellations`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Sold the herd' });
    request.flush({ ...pending, status: 'Cancelled', cancellationReason: 'Sold the herd' });
    expect((await result).status).toBe('Cancelled');
  });

  it('keeps a payment failure as an ApiError for the screen', async () => {
    const outcome = repository.startCheckout('ranch-1', 'subscription-1').then(() => null, (error: unknown) => error);
    http.expectOne(`${subscriptionsUrl}/subscription-1/checkout-sessions`).flush(
      { status: 503, title: 'The payment provider is unavailable.', code: 'SubscriptionPlans.PaymentProviderUnavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(await outcome).toBeInstanceOf(ApiError);
    expect(await outcome).toMatchObject({ status: 503, code: 'SubscriptionPlans.PaymentProviderUnavailable' });
  });
});
