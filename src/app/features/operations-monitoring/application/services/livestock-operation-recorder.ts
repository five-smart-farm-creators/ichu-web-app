import { inject, Injectable } from '@angular/core';
import { isClinicalRecord, type OperationRecordInput } from '../../domain/model/livestock-operation.model';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';

/** Sends one record to the endpoint of its kind; a failed attempt keeps its operation ID, so a retry cannot store a duplicate. */
@Injectable()
export class LivestockOperationRecorder {
  private readonly records = inject(LivestockOperationRepository);
  private pendingAttempt: { readonly key: string; readonly operationId: string } | null = null;

  /** A changed or new record gets a new operation ID; a replay the API answers with 200 counts as saved. */
  async register(ranchId: string, record: OperationRecordInput): Promise<void> {
    const key = JSON.stringify({ ranchId, record });
    const operationId = this.pendingAttempt?.key === key ? this.pendingAttempt.operationId : crypto.randomUUID();
    this.pendingAttempt = { key, operationId };
    if (isClinicalRecord(record)) {
      await this.records.registerClinicalIntervention(ranchId, { operationId, ...record });
    } else {
      await this.records.registerFieldEvent(ranchId, { operationId, ...record });
    }
    this.pendingAttempt = null;
  }
}
