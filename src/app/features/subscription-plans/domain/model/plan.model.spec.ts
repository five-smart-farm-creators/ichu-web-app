import { headCountOf, isValidHeadCount, type Plan, planTierOf, recommendedPlan } from './plan.model';

function plan(id: string, tier: Plan['tier'], deviceLimit: number): Plan {
  return {
    id,
    tier,
    name: tier,
    deviceLimit,
    annualFee: { amount: 600, currency: 'PEN' },
    deviceUnitPrice: { amount: 120, currency: 'PEN' },
    features: ['Monitoring'],
  };
}

const catalog = [plan('basic', 'Basic', 50), plan('standard', 'Standard', 200), plan('pro', 'Pro', 500)];

describe('plan model', () => {
  it('recommends the smallest plan whose device limit covers the head count', () => {
    expect(recommendedPlan(catalog, 50)?.id).toBe('basic');
    expect(recommendedPlan(catalog, 51)?.id).toBe('standard');
    expect(recommendedPlan(catalog, 501)).toBeNull();
  });

  it('accepts only whole head counts from 1 to 10,000', () => {
    expect(isValidHeadCount(1)).toBe(true);
    expect(isValidHeadCount(10000)).toBe(true);
    expect(isValidHeadCount(0)).toBe(false);
    expect(isValidHeadCount(10001)).toBe(false);
    expect(isValidHeadCount(2.5)).toBe(false);
    expect(isValidHeadCount(null)).toBe(false);
  });

  it('reads a tier and a head count from a link and ignores other values', () => {
    expect(planTierOf('Standard')).toBe('Standard');
    expect(planTierOf('standard')).toBeNull();
    expect(headCountOf('120')).toBe(120);
    expect(headCountOf('0')).toBeNull();
    expect(headCountOf('12.5')).toBeNull();
    expect(headCountOf('abc')).toBeNull();
    expect(headCountOf(null)).toBeNull();
  });
});
