import type { ReportedPeriod } from './herd-indicators.model';

/** Conditions the server has incubation periods for; any other name comes back as unavailable. */
export const CURVE_CONDITIONS = ['temperature', 'activity'] as const;
export type CurveCondition = (typeof CURVE_CONDITIONS)[number];

/** Daily new cases by their onset day (UTC, yyyy-MM-dd) and whether the window covers the incubation period. */
export interface EpidemiologicalCurve {
  readonly ranchId: string;
  readonly period: ReportedPeriod;
  readonly updatedAt: string;
  readonly source: string;
  readonly condition: string;
  readonly newCasesByDay: Readonly<Record<string, number>>;
  readonly daysWithoutNewCases: number | null;
  readonly supportsRestrictionLifting: boolean | null;
  readonly unavailableReason: string | null;
}
