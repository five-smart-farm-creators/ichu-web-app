import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { Money, Plan, PlanQuote } from '../../domain/model/plan.model';
import { PlanRepository } from '../../domain/repositories/plan.repository';
import { PlansFacade } from './plans.facade';

function money(amount: number): Money {
  return { amount, currency: 'PEN' };
}

function plan(id: string, tier: Plan['tier'], deviceLimit: number): Plan {
  return { id, tier, name: tier, deviceLimit, annualFee: money(600), deviceUnitPrice: money(120), features: ['Monitoring'] };
}

function quote(planId: string, headCount: number): PlanQuote {
  const devicesCost = 120 * headCount;
  return {
    planId,
    headCount,
    annualFee: money(600),
    deviceUnitPrice: money(120),
    devicesCost: money(devicesCost),
    total: money(600 + devicesCost),
    periodicity: 'Annual',
  };
}

const catalog = [plan('basic', 'Basic', 50), plan('standard', 'Standard', 200), plan('pro', 'Pro', 500)];

describe('PlansFacade', () => {
  let facade: PlansFacade;
  let repository: { list: ReturnType<typeof vi.fn>; quote: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    repository = {
      list: vi.fn(async () => catalog),
      quote: vi.fn(async (planId: string, headCount: number) => quote(planId, headCount)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PlansFacade, { provide: PlanRepository, useValue: repository }],
    });
    facade = TestBed.inject(PlansFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('loads the catalog and quotes the head count the visitor arrived with', async () => {
    await facade.open({ tier: 'Standard', headCount: 120 });

    expect(facade.plans()).toEqual(catalog);
    expect(repository.quote).toHaveBeenCalledTimes(3);
    expect(repository.quote).toHaveBeenCalledWith('standard', 120);
    expect(facade.quotes().get('standard')?.total.amount).toBe(600 + 120 * 120);
    expect(facade.selectedTier()).toBe('Standard');
    expect(facade.recommended()?.id).toBe('standard');
    expect(facade.quoting()).toBe(false);
  });

  it('waits for a pause in typing before it requests quotes', async () => {
    await facade.open({ tier: null, headCount: null });

    facade.setHeadCount(1);
    facade.setHeadCount(12);
    facade.setHeadCount(120);
    expect(repository.quote).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(repository.quote).toHaveBeenCalledTimes(3);
    expect(repository.quote).not.toHaveBeenCalledWith('basic', 12);
    expect(repository.quote).toHaveBeenCalledWith('basic', 120);
  });

  it('drops every quote when the head count is no longer valid', async () => {
    await facade.open({ tier: null, headCount: 120 });

    facade.setHeadCount(null);
    await vi.advanceTimersByTimeAsync(300);

    expect(facade.quotes().size).toBe(0);
    expect(facade.quoteErrors().size).toBe(0);
    expect(repository.quote).toHaveBeenCalledTimes(3);
  });

  it('ignores the answers of a head count the visitor has already changed', async () => {
    await facade.open({ tier: null, headCount: 120 });
    const pending: Array<(value: PlanQuote) => void> = [];
    repository.quote.mockImplementation(() => new Promise<PlanQuote>(resolve => pending.push(resolve)));

    facade.setHeadCount(12);
    await vi.advanceTimersByTimeAsync(300);
    repository.quote.mockImplementation(async (planId: string, headCount: number) => quote(planId, headCount));
    facade.setHeadCount(120);
    await vi.advanceTimersByTimeAsync(300);
    pending.forEach((resolve, index) => resolve(quote(catalog[index].id, 12)));
    await vi.advanceTimersByTimeAsync(0);

    expect(facade.quotes().size).toBe(3);
    expect(facade.quotes().get('basic')?.headCount).toBe(120);
  });

  it('keeps the error of one plan and still quotes the others', async () => {
    repository.quote.mockImplementation(async (planId: string, headCount: number) => {
      if (planId === 'basic') {
        throw new ApiError(400, 'SubscriptionPlans.HeadCountExceedsPlan', 'The head count exceeds the device limit of this plan.');
      }
      return quote(planId, headCount);
    });

    await facade.open({ tier: null, headCount: 120 });

    expect(facade.quoteErrors().get('basic')).toMatchObject({
      status: 400,
      title: 'The head count exceeds the device limit of this plan.',
    });
    expect(facade.quotes().has('basic')).toBe(false);
    expect(facade.quotes().has('standard')).toBe(true);
  });

  it('reports a failed catalog load for the screen', async () => {
    repository.list.mockRejectedValueOnce(new ApiError(0, 'network', null));

    await facade.open({ tier: null, headCount: null });

    expect(facade.error()?.code).toBe('network');
    expect(facade.loading()).toBe(false);
  });
});
