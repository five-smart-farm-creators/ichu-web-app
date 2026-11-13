import type { NutritionPlan, RegisterNutritionPlan } from '../model/nutrition-plan.model';

/** Reads and registers the nutrition plans of one lot. */
export abstract class NutritionPlanRepository {
  /** Newest first, as the API returns them. */
  abstract list(ranchId: string, lotId: string): Promise<readonly NutritionPlan[]>;
  /** The plan in force on the UTC date that the API uses; null when no plan covers that day. */
  abstract current(ranchId: string, lotId: string): Promise<NutritionPlan | null>;
  abstract register(ranchId: string, lotId: string, request: RegisterNutritionPlan): Promise<NutritionPlan>;
}
