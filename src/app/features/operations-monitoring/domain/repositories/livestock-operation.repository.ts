import type {
  LivestockOperation, OperationPeriod, RecordClinicalIntervention, RecordFieldEvent,
} from '../model/livestock-operation.model';

/** Lists and registers the field events and clinical interventions of one ranch's animals. */
export abstract class LivestockOperationRepository {
  abstract list(ranchId: string, cattleId: string, period: OperationPeriod): Promise<readonly LivestockOperation[]>;
  abstract registerFieldEvent(ranchId: string, request: RecordFieldEvent): Promise<LivestockOperation>;
  abstract registerClinicalIntervention(ranchId: string, request: RecordClinicalIntervention): Promise<LivestockOperation>;
}
