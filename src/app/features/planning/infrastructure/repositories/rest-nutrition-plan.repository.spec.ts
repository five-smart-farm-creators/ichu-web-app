import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { NutritionPlan, RegisterNutritionPlan } from '../../domain/model/nutrition-plan.model';
import { RestNutritionPlanRepository } from './rest-nutrition-plan.repository';

const plansUrl = 'https://api.example.test/api/v1/lots/lot-1/nutrition-plans';

const plan: NutritionPlan = {
  id: 'plan-1', lotId: 'lot-1', name: 'Dry season', validFrom: '2026-11-01', validTo: null,
  items: [{ feed: 'Pasture', kind: 'Forage', kilogramsPerHeadPerDay: 12 }], targetDailyGainKilograms: 0.5, notes: null,
};

describe('RestNutritionPlanRepository', () => {
  let http: HttpTestingController;
  let repository: RestNutritionPlanRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestNutritionPlanRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestNutritionPlanRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the nutrition plans of the lot', async () => {
    const result = repository.list('ranch-1', 'lot-1');
    const request = http.expectOne(plansUrl);

    expect(request.request.method).toBe('GET');
    request.flush([plan]);
    expect(await result).toEqual([plan]);
  });

  it('reads the plan in force without a day, so the API applies its UTC date', async () => {
    const result = repository.current('ranch-1', 'lot-1');
    const request = http.expectOne(plansUrl + '/current');

    expect(request.request.params.keys()).toEqual([]);
    request.flush(plan);
    expect(await result).toEqual(plan);
  });

  it('answers null when no plan covers the day, instead of failing', async () => {
    const result = repository.current('ranch-1', 'lot-1');
    http.expectOne(plansUrl + '/current')
      .flush({ code: 'Planning.NoCurrentNutritionPlan', title: 'No current plan.' }, { status: 404, statusText: 'Not Found' });

    expect(await result).toBeNull();
  });

  it('keeps every other failure of the current plan read as an error', async () => {
    const result = repository.current('ranch-1', 'lot-1');
    http.expectOne(plansUrl + '/current')
      .flush({ code: 'Planning.LotNotFound', title: 'Lot not found.' }, { status: 404, statusText: 'Not Found' });

    await expect(result).rejects.toMatchObject({ status: 404, code: 'Planning.LotNotFound' });
  });

  it('registers a plan with its ration items and returns the stored plan', async () => {
    const request: RegisterNutritionPlan = {
      name: 'Dry season', validFrom: '2026-11-01', validTo: null,
      items: [{ feed: 'Pasture', kind: 'Forage', kilogramsPerHeadPerDay: 12 }], targetDailyGainKilograms: 0.5, notes: null,
    };
    const result = repository.register('ranch-1', 'lot-1', request);
    const call = http.expectOne(plansUrl);

    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush(plan, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(plan);
  });
});
