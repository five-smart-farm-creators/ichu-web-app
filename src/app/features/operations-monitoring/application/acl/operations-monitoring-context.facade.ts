import { inject, Injectable } from '@angular/core';
import {
  type ClinicalInterventionType, DAY_MILLISECONDS, isClinicalType,
} from '../../domain/model/livestock-operation.model';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';

/** A clinical intervention as Planning reads it: identity, animal, type and day, without the product or the author. */
export interface ClinicalInterventionSummary {
  readonly interventionId: string;
  readonly cattleId: string;
  readonly type: ClinicalInterventionType;
  readonly occurredAt: string;
}

/** The earliest day the history is read from, so every recorded intervention can be linked. */
const EARLIEST_RECORD = new Date('2000-01-01T00:00:00Z');

/** Publishes clinical interventions to Planning, which links applications to them. */
@Injectable()
export class OperationsMonitoringContextFacade {
  private readonly operations = inject(LivestockOperationRepository);

  /** Lists an animal's clinical interventions up to tomorrow, so an intervention registered today can be linked. */
  async interventionsFor(ranchId: string, cattleId: string): Promise<readonly ClinicalInterventionSummary[]> {
    const operations = await this.operations.list(ranchId, cattleId, {
      from: EARLIEST_RECORD,
      to: new Date(Date.now() + DAY_MILLISECONDS),
    });
    return operations.flatMap(operation => isClinicalType(operation.type)
      ? [{ interventionId: operation.operationId, cattleId: operation.cattleId, type: operation.type, occurredAt: operation.occurredAt }]
      : []);
  }
}
