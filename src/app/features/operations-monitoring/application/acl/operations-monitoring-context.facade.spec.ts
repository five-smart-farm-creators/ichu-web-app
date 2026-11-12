import { TestBed } from '@angular/core/testing';
import { isClinicalType, type LivestockOperation } from '../../domain/model/livestock-operation.model';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { OperationsMonitoringContextFacade } from './operations-monitoring-context.facade';

function operation(id: string, type: LivestockOperation['type']): LivestockOperation {
  const clinical = isClinicalType(type);
  return {
    operationId: id, cattleId: 'cattle-1', type, isClinical: clinical, occurredAt: '2026-11-10T10:00:00.000Z',
    receivedAt: '2026-11-10T10:00:00.000Z', observation: 'Note', product: clinical ? 'Vaccine' : null, dose: null,
    sireReference: null, pregnancyResult: null, expectedCalvingDate: null,
  };
}

describe('OperationsMonitoringContextFacade', () => {
  let facade: OperationsMonitoringContextFacade;
  let operations: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    operations = {
      list: vi.fn(async () => [operation('vaccination-1', 'Vaccination'), operation('birth-1', 'Birth'), operation('treatment-1', 'Treatment')]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [OperationsMonitoringContextFacade, { provide: LivestockOperationRepository, useValue: operations }],
    });
    facade = TestBed.inject(OperationsMonitoringContextFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('publishes only the clinical interventions, without the product, the author or the notes', async () => {
    expect(await facade.interventionsFor('ranch-1', 'cattle-1')).toEqual([
      { interventionId: 'vaccination-1', cattleId: 'cattle-1', type: 'Vaccination', occurredAt: '2026-11-10T10:00:00.000Z' },
      { interventionId: 'treatment-1', cattleId: 'cattle-1', type: 'Treatment', occurredAt: '2026-11-10T10:00:00.000Z' },
    ]);
  });

  it('reads from the earliest record up to tomorrow', async () => {
    await facade.interventionsFor('ranch-1', 'cattle-1');

    const period = operations.list.mock.calls[0][2] as { from: Date; to: Date };
    expect(period.from).toEqual(new Date('2000-01-01T00:00:00Z'));
    expect(period.to.getTime()).toBeGreaterThan(Date.now());
  });
});
