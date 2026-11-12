/** Field events are observed by the operator and need the manage scope in the API. */
export const FIELD_EVENT_TYPES = ['HealthEvent', 'Birth'] as const;
export type FieldEventType = (typeof FIELD_EVENT_TYPES)[number];

/** Clinical interventions are applied by a veterinarian; only these accept a product and a dose. */
export const CLINICAL_INTERVENTION_TYPES = ['Vaccination', 'Treatment', 'Insemination'] as const;
export type ClinicalInterventionType = (typeof CLINICAL_INTERVENTION_TYPES)[number];

export type OperationType = FieldEventType | ClinicalInterventionType;

export const OPERATION_TYPES: readonly OperationType[] = [...FIELD_EVENT_TYPES, ...CLINICAL_INTERVENTION_TYPES];

export const DAY_MILLISECONDS = 86_400_000;

export const OBSERVATION_MAX_LENGTH = 500;
export const PRODUCT_MAX_LENGTH = 120;
export const DOSE_MAX_LENGTH = 60;

/** A recorded field event or clinical intervention; the author stays in the API and is never shown. */
export interface LivestockOperation {
  readonly operationId: string;
  readonly cattleId: string;
  readonly type: OperationType;
  readonly isClinical: boolean;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly observation: string | null;
  readonly product: string | null;
  readonly dose: string | null;
}

interface OperationRecord {
  readonly operationId: string;
  readonly cattleId: string;
  readonly occurredAt: string;
  readonly observation: string | null;
}

export interface RecordFieldEvent extends OperationRecord {
  readonly type: FieldEventType;
}

export interface RecordClinicalIntervention extends OperationRecord {
  readonly type: ClinicalInterventionType;
  readonly product: string | null;
  readonly dose: string | null;
}

/** A half-open period: the start is included and the end is excluded. */
export interface OperationPeriod {
  readonly from: Date;
  readonly to: Date;
}

export function isClinicalType(type: OperationType): type is ClinicalInterventionType {
  return (CLINICAL_INTERVENTION_TYPES as readonly string[]).includes(type);
}
