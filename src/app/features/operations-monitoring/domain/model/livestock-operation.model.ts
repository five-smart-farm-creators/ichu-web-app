/** Field events are observed by the operator; breeding services, calvings, abortions and heats are field events too. */
export const FIELD_EVENT_TYPES = ['HealthEvent', 'Birth', 'NaturalMating', 'HeatObserved', 'Abortion'] as const;
export type FieldEventType = (typeof FIELD_EVENT_TYPES)[number];

/** Clinical interventions are applied by a veterinarian; only these accept a product and a dose. */
export const CLINICAL_INTERVENTION_TYPES = ['Vaccination', 'Treatment', 'Insemination', 'PregnancyDiagnosis'] as const;
export type ClinicalInterventionType = (typeof CLINICAL_INTERVENTION_TYPES)[number];

export type OperationType = FieldEventType | ClinicalInterventionType;

export const OPERATION_TYPES: readonly OperationType[] = [...FIELD_EVENT_TYPES, ...CLINICAL_INTERVENTION_TYPES];

/** Only a breeding service names a sire; the API rejects a sire on every other type. */
export const BREEDING_SERVICE_TYPES: readonly OperationType[] = ['NaturalMating', 'Insemination'];

/** The API accepts these types for a female animal only. */
export const REPRODUCTIVE_TYPES: readonly OperationType[] = [
  'NaturalMating', 'Insemination', 'PregnancyDiagnosis', 'Birth', 'Abortion', 'HeatObserved',
];

export const PREGNANCY_RESULTS = ['Pregnant', 'Open'] as const;
export type PregnancyResult = (typeof PREGNANCY_RESULTS)[number];

export const DAY_MILLISECONDS = 86_400_000;

export const OBSERVATION_MAX_LENGTH = 500;
export const PRODUCT_MAX_LENGTH = 120;
export const DOSE_MAX_LENGTH = 60;
export const SIRE_REFERENCE_MAX_LENGTH = 80;

/** The API accepts an expected calving date at most this many days after the diagnosis day. */
export const MAX_DAYS_TO_CALVING = 300;

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
  readonly sireReference: string | null;
  readonly pregnancyResult: PregnancyResult | null;
  /** A calendar day, yyyy-MM-dd. */
  readonly expectedCalvingDate: string | null;
}

/** Reproductive facts of a record; the API accepts only the ones that its type defines. */
export interface ReproductiveFacts {
  readonly sireReference?: string | null;
  readonly pregnancyResult?: PregnancyResult | null;
  readonly expectedCalvingDate?: string | null;
}

interface OperationRecord extends ReproductiveFacts {
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

/** A record before the client assigns its operation ID. */
export type FieldEventInput = Omit<RecordFieldEvent, 'operationId'>;
export type ClinicalInterventionInput = Omit<RecordClinicalIntervention, 'operationId'>;
export type OperationRecordInput = FieldEventInput | ClinicalInterventionInput;

/** A half-open period: the start is included and the end is excluded. */
export interface OperationPeriod {
  readonly from: Date;
  readonly to: Date;
}

export function isClinicalType(type: OperationType): type is ClinicalInterventionType {
  return (CLINICAL_INTERVENTION_TYPES as readonly string[]).includes(type);
}

export function isClinicalRecord(record: OperationRecordInput): record is ClinicalInterventionInput {
  return isClinicalType(record.type);
}

/** Keeps only the types the account may register for an animal: a female for reproductive types, and each scope for its own kind. */
export function registrableTypes(
  types: readonly OperationType[],
  access: { readonly canRecordField: boolean; readonly canRecordClinical: boolean },
  sex: string,
): OperationType[] {
  return types.filter(type => (isClinicalType(type) ? access.canRecordClinical : access.canRecordField)
    && (sex === 'Female' || !REPRODUCTIVE_TYPES.includes(type)));
}

/** The local calendar day of an instant as yyyy-MM-dd, the form in which the API reads a date. */
export function calendarDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The API counts the diagnosis day in UTC, so the client does too; the calving date must fall after that day and within MAX_DAYS_TO_CALVING days. */
export function expectedCalvingDateProblem(
  diagnosisDay: string,
  expectedCalvingDate: string,
): 'notAfterDiagnosis' | 'tooFar' | null {
  if (expectedCalvingDate <= diagnosisDay) return 'notAfterDiagnosis';
  const latestDay = new Date(Date.parse(diagnosisDay + 'T00:00:00Z') + MAX_DAYS_TO_CALVING * DAY_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
  return expectedCalvingDate > latestDay ? 'tooFar' : null;
}
