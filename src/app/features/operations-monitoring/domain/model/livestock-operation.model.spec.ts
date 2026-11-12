import {
  expectedCalvingDateProblem, FIELD_EVENT_TYPES, isClinicalRecord, isClinicalType, OPERATION_TYPES, registrableTypes,
} from './livestock-operation.model';

describe('livestock operation types', () => {
  it('splits field events from clinical interventions and lists all nine types', () => {
    expect(FIELD_EVENT_TYPES).toEqual(['HealthEvent', 'Birth', 'NaturalMating', 'HeatObserved', 'Abortion']);
    expect(OPERATION_TYPES).toHaveLength(9);
  });

  it('recognizes vaccination, treatment, insemination and pregnancy diagnosis as clinical', () => {
    expect(isClinicalType('Vaccination')).toBe(true);
    expect(isClinicalType('Treatment')).toBe(true);
    expect(isClinicalType('Insemination')).toBe(true);
    expect(isClinicalType('PregnancyDiagnosis')).toBe(true);
    expect(isClinicalType('Birth')).toBe(false);
    expect(isClinicalType('NaturalMating')).toBe(false);
  });

  it('routes a record by its type', () => {
    const clinical = { cattleId: 'cattle-1', type: 'Insemination', occurredAt: '2026-11-10T10:00:00.000Z', observation: null, product: null, dose: null } as const;
    const field = { cattleId: 'cattle-1', type: 'Birth', occurredAt: '2026-11-10T10:00:00.000Z', observation: null } as const;

    expect(isClinicalRecord(clinical)).toBe(true);
    expect(isClinicalRecord(field)).toBe(false);
  });
});

describe('registrableTypes', () => {
  const everything = { canRecordField: true, canRecordClinical: true };

  it('hides the reproductive types from a male animal', () => {
    expect(registrableTypes(OPERATION_TYPES, everything, 'Male')).toEqual(['HealthEvent', 'Vaccination', 'Treatment']);
  });

  it('keeps the clinical types for a veterinarian and the field types for a manager', () => {
    const veterinarian = { canRecordField: false, canRecordClinical: true };
    const manager = { canRecordField: true, canRecordClinical: false };

    expect(registrableTypes(OPERATION_TYPES, veterinarian, 'Female')).toEqual(['Vaccination', 'Treatment', 'Insemination', 'PregnancyDiagnosis']);
    expect(registrableTypes(OPERATION_TYPES, manager, 'Female')).toEqual(['HealthEvent', 'Birth', 'NaturalMating', 'HeatObserved', 'Abortion']);
  });
});

describe('expectedCalvingDateProblem', () => {
  it('requires a calving day after the diagnosis day', () => {
    expect(expectedCalvingDateProblem('2026-11-10', '2026-11-10')).toBe('notAfterDiagnosis');
    expect(expectedCalvingDateProblem('2026-11-10', '2026-11-09')).toBe('notAfterDiagnosis');
    expect(expectedCalvingDateProblem('2026-11-10', '2026-11-11')).toBeNull();
  });

  it('accepts a day up to 300 days after the diagnosis day and refuses a later one', () => {
    expect(expectedCalvingDateProblem('2026-11-10', '2027-09-06')).toBeNull();
    expect(expectedCalvingDateProblem('2026-11-10', '2027-09-07')).toBe('tooFar');
  });
});
