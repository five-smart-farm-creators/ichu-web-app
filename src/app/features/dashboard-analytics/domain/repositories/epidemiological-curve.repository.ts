import type { AnalyticsPeriod } from '../model/analytics-period';
import type { EpidemiologicalCurve } from '../model/epidemiological-curve.model';

/** Reads the daily case progression of one condition. */
export abstract class EpidemiologicalCurveRepository {
  abstract curve(ranchId: string, period: AnalyticsPeriod, condition: string): Promise<EpidemiologicalCurve>;
}
