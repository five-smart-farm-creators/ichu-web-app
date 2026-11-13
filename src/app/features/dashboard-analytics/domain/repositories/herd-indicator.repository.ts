import type { AnalyticsPeriod } from '../model/analytics-period';
import type { HerdIndicators } from '../model/herd-indicators.model';

/** Reads the herd indicators of one ranch and period. */
export abstract class HerdIndicatorRepository {
  abstract dashboard(ranchId: string, period: AnalyticsPeriod): Promise<HerdIndicators>;
}
