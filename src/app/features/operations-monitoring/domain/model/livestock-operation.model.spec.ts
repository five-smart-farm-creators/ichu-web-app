import { FIELD_EVENT_TYPES, isClinicalType, OPERATION_TYPES } from './livestock-operation.model';

describe('livestock operation types', () => {
  it('splits field events from clinical interventions and lists all five types', () => {
    expect(FIELD_EVENT_TYPES).toEqual(['HealthEvent', 'Birth']);
    expect(OPERATION_TYPES).toHaveLength(5);
  });

  it('recognizes only vaccination, treatment and insemination as clinical', () => {
    expect(isClinicalType('Vaccination')).toBe(true);
    expect(isClinicalType('Treatment')).toBe(true);
    expect(isClinicalType('Insemination')).toBe(true);
    expect(isClinicalType('Birth')).toBe(false);
    expect(isClinicalType('HealthEvent')).toBe(false);
  });
});
