import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { FieldEventInput } from '../../domain/model/livestock-operation.model';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { LivestockOperationRecorder } from './livestock-operation-recorder';

const fieldEvent: FieldEventInput = {
  cattleId: 'cattle-1', type: 'HealthEvent', occurredAt: '2026-11-10T10:00:00.000Z', observation: 'Limping on the left leg',
};

describe('LivestockOperationRecorder', () => {
  let recorder: LivestockOperationRecorder;
  let records: { registerFieldEvent: ReturnType<typeof vi.fn>; registerClinicalIntervention: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    records = {
      registerFieldEvent: vi.fn(async (_ranchId: string, request: { operationId: string }) => ({ operationId: request.operationId })),
      registerClinicalIntervention: vi.fn(async (_ranchId: string, request: { operationId: string }) => ({ operationId: request.operationId })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [LivestockOperationRecorder, { provide: LivestockOperationRepository, useValue: records }],
    });
    recorder = TestBed.inject(LivestockOperationRecorder);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reuses the operation ID when the same record is retried after a failure', async () => {
    records.registerFieldEvent.mockRejectedValueOnce(new ApiError(0, 'network', null));

    await expect(recorder.register('ranch-1', fieldEvent)).rejects.toMatchObject({ code: 'network' });
    await recorder.register('ranch-1', fieldEvent);

    const [first, retry] = records.registerFieldEvent.mock.calls.map(call => call[1]);
    expect(retry.operationId).toBe(first.operationId);
    expect(retry).toMatchObject({ cattleId: 'cattle-1', type: 'HealthEvent', observation: 'Limping on the left leg' });
  });

  it('uses a new operation ID for a changed record and for the next record after a save', async () => {
    records.registerFieldEvent.mockRejectedValueOnce(new ApiError(0, 'network', null));
    await expect(recorder.register('ranch-1', fieldEvent)).rejects.toBeInstanceOf(ApiError);

    await recorder.register('ranch-1', { ...fieldEvent, observation: 'Changed observation' });
    await recorder.register('ranch-1', { ...fieldEvent, observation: 'Changed observation' });

    const [failed, changed, next] = records.registerFieldEvent.mock.calls.map(call => call[1].operationId);
    expect(changed).not.toBe(failed);
    expect(next).not.toBe(changed);
  });

  it('sends a clinical type to the clinical endpoint with its product and dose', async () => {
    await recorder.register('ranch-1', {
      cattleId: 'cattle-1', type: 'Vaccination', occurredAt: '2026-11-10T10:00:00.000Z', observation: null,
      product: 'Foot-and-mouth vaccine', dose: '2 ml',
    });

    expect(records.registerClinicalIntervention).toHaveBeenCalledWith('ranch-1', expect.objectContaining({
      cattleId: 'cattle-1', type: 'Vaccination', product: 'Foot-and-mouth vaccine', dose: '2 ml',
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }));
    expect(records.registerFieldEvent).not.toHaveBeenCalled();
  });

  it('sends a breeding service as a field event that names its sire', async () => {
    await recorder.register('ranch-1', {
      cattleId: 'cattle-1', type: 'NaturalMating', occurredAt: '2026-11-10T10:00:00.000Z', observation: null, sireReference: 'Bull 7',
    });

    expect(records.registerFieldEvent).toHaveBeenCalledWith('ranch-1', expect.objectContaining({ type: 'NaturalMating', sireReference: 'Bull 7' }));
    expect(records.registerClinicalIntervention).not.toHaveBeenCalled();
  });
});
