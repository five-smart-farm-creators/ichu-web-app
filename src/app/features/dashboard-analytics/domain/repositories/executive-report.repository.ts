import type { AnalyticsPeriod } from '../model/analytics-period';
import type { DownloadedFile, ExecutiveReportDocument } from '../model/executive-report.model';

/** Reads the executive report as a JSON document or as a CSV file. */
export abstract class ExecutiveReportRepository {
  abstract document(ranchId: string, period: AnalyticsPeriod): Promise<ExecutiveReportDocument>;
  abstract csv(ranchId: string, period: AnalyticsPeriod): Promise<DownloadedFile>;
}
