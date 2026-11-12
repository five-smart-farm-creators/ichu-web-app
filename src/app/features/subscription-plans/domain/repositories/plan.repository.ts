import type { Plan, PlanQuote } from '../model/plan.model';

/** Reads the published plan catalog and the quote of a plan for a head count; visitors need no account for either. */
export abstract class PlanRepository {
  abstract list(): Promise<readonly Plan[]>;
  abstract quote(planId: string, headCount: number): Promise<PlanQuote>;
}
