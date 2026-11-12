import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { RestPlanRepository } from './rest-plan.repository';

const plansUrl = 'https://api.example.test/api/v1/plans';
const basic = {
  id: 'plan-1',
  tier: 'Basic',
  name: 'Basic',
  deviceLimit: 50,
  annualFee: { amount: 600, currency: 'PEN' },
  deviceUnitPrice: { amount: 120, currency: 'PEN' },
  features: ['Monitoring'],
};
const quote = {
  planId: 'plan-1',
  headCount: 40,
  annualFee: { amount: 600, currency: 'PEN' },
  deviceUnitPrice: { amount: 120, currency: 'PEN' },
  devicesCost: { amount: 4800, currency: 'PEN' },
  total: { amount: 5400, currency: 'PEN' },
  periodicity: 'Annual',
};

describe('RestPlanRepository', () => {
  let http: HttpTestingController;
  let repository: RestPlanRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestPlanRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestPlanRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the published plans', async () => {
    const result = repository.list();
    const request = http.expectOne(plansUrl);

    expect(request.request.method).toBe('GET');
    request.flush([basic]);
    expect(await result).toEqual([basic]);
  });

  it('quotes a plan for a head count sent as a query parameter', async () => {
    const result = repository.quote('plan-1', 40);
    const request = http.expectOne(candidate => candidate.url === `${plansUrl}/plan-1/quote` && candidate.params.get('headCount') === '40');

    expect(request.request.method).toBe('GET');
    request.flush(quote);
    expect(await result).toEqual(quote);
  });

  it('turns the ProblemDetails of a rejected quote into an ApiError with its localized title', async () => {
    const outcome = repository.quote('plan-1', 600).then(() => null, (error: unknown) => error);
    const request = http.expectOne(candidate => candidate.url === `${plansUrl}/plan-1/quote`);
    request.flush(
      { status: 400, title: 'The head count exceeds the device limit of this plan.', code: 'SubscriptionPlans.HeadCountExceedsPlan' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await outcome).toBeInstanceOf(ApiError);
    expect(await outcome).toMatchObject({
      status: 400,
      code: 'SubscriptionPlans.HeadCountExceedsPlan',
      title: 'The head count exceeds the device limit of this plan.',
    });
  });
});
