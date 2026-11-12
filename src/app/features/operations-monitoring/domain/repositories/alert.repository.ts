import type { AcknowledgeAlert, Alert, AlertFilter, AlertPage } from '../model/alert.model';

/** Lists and acknowledges the alerts of one ranch; a stale acknowledgement fails with the version conflict code. */
export abstract class AlertRepository {
  abstract list(ranchId: string, filter: AlertFilter, page: number, pageSize: number): Promise<AlertPage>;
  abstract acknowledge(ranchId: string, alertId: string, request: AcknowledgeAlert): Promise<Alert>;
}
