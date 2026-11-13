/** Feed classes of a ration; the API and the screens exchange them as text. */
export const RATION_KINDS = ['Forage', 'Concentrate', 'Supplement', 'Mineral'] as const;
export type RationKind = (typeof RATION_KINDS)[number];

export const NUTRITION_NAME_MAX_LENGTH = 80;
export const NUTRITION_NOTES_MAX_LENGTH = 500;
export const FEED_MAX_LENGTH = 80;
export const KILOGRAMS_PER_HEAD_MAX = 100;
export const TARGET_DAILY_GAIN_MAX = 3;

/** One feed of a ration with the quantity that each head receives every day. */
export interface RationItem {
  readonly feed: string;
  readonly kind: RationKind;
  readonly kilogramsPerHeadPerDay: number;
}

/** The ration of a lot over an inclusive range of days; an open end keeps the plan in force until a later plan starts. */
export interface NutritionPlan {
  readonly id: string;
  readonly lotId: string;
  readonly name: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly items: readonly RationItem[];
  readonly targetDailyGainKilograms: number | null;
  readonly notes: string | null;
}

export interface RegisterNutritionPlan {
  readonly name: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly items: readonly RationItem[];
  readonly targetDailyGainKilograms: number | null;
  readonly notes: string | null;
}

/** The API accepts a quantity above zero and at most KILOGRAMS_PER_HEAD_MAX kilograms per head per day. */
export function isValidRationQuantity(kilograms: number | null | undefined): boolean {
  return typeof kilograms === 'number' && Number.isFinite(kilograms) && kilograms > 0 && kilograms <= KILOGRAMS_PER_HEAD_MAX;
}

/** The target gain is optional; when it is given it must be above zero and at most TARGET_DAILY_GAIN_MAX. */
export function isValidTargetGain(kilograms: number | null | undefined): boolean {
  if (kilograms === null || kilograms === undefined) return true;
  return Number.isFinite(kilograms) && kilograms > 0 && kilograms <= TARGET_DAILY_GAIN_MAX;
}

/** Days are compared as yyyy-MM-dd text, which sorts in calendar order; an open end is always valid. */
export function isValidPlanValidity(validFrom: string, validTo: string | null): boolean {
  return validTo === null || validTo >= validFrom;
}

/** The feed that the whole lot eats each day, estimated from each head's ration and the head count of the lot. */
export function lotDailyKilograms(items: readonly RationItem[], headCount: number): number {
  return items.reduce((sum, item) => sum + item.kilogramsPerHeadPerDay, 0) * headCount;
}

/** The days on which a ration changed: every plan after the first one starts a change on its first day. */
export function rationChangeDays(plans: readonly Pick<NutritionPlan, 'validFrom'>[]): Set<string> {
  return new Set(plans.map(plan => plan.validFrom).sort().slice(1));
}
