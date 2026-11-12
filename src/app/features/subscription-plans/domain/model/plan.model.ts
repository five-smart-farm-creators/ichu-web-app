/** Commercial tiers, ordered from the smallest to the largest device limit; the API and the screens exchange them as text. */
export const PLAN_TIERS = ['Basic', 'Standard', 'Pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_FEATURES = ['Monitoring', 'Alerts', 'Planning', 'Analytics', 'ReportExport'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** The API accepts head counts from 1 to 10,000, a whole number each. */
export const MIN_HEAD_COUNT = 1;
export const MAX_HEAD_COUNT = 10000;

/** An amount in one currency exactly as the API returned it; the screens format amounts and never compute them. */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export interface Plan {
  readonly id: string;
  readonly tier: PlanTier;
  readonly name: string;
  readonly deviceLimit: number;
  readonly annualFee: Money;
  readonly deviceUnitPrice: Money;
  readonly features: readonly PlanFeature[];
}

/** The annual price of a plan for a head count: the annual fee plus the devices cost. */
export interface PlanQuote {
  readonly planId: string;
  readonly headCount: number;
  readonly annualFee: Money;
  readonly deviceUnitPrice: Money;
  readonly devicesCost: Money;
  readonly total: Money;
  readonly periodicity: string;
}

export function isValidHeadCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= MIN_HEAD_COUNT && value <= MAX_HEAD_COUNT;
}

/** Highlights the smallest plan whose device limit covers the head count; the quote from the API stays the price. */
export function recommendedPlan(plans: readonly Plan[], headCount: number): Plan | null {
  return [...plans]
    .sort((first, second) => first.deviceLimit - second.deviceLimit)
    .find(plan => plan.deviceLimit >= headCount) ?? null;
}

/** Reads a tier from a link such as the website's plan buttons; an unknown value is ignored. */
export function planTierOf(value: string | null): PlanTier | null {
  return PLAN_TIERS.find(tier => tier === value) ?? null;
}

/** Reads a head count from a link; only whole numbers in the accepted range are kept. */
export function headCountOf(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return isValidHeadCount(count) ? count : null;
}
