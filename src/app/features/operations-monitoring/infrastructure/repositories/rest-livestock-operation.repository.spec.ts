import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestLivestockOperationRepository } from './rest-livestock-operation.repository';

const ranchUrl = 'https://api.example.test/api/v1/ranches/ranch-1';

describe('RestLivestockOperationRepository', () => {
  let http: HttpTestingController;
  let repository: RestLivestockOperationRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestLivestockOperationRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestLivestockOperationRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the operations of an animal within the half-open period', async () => {
    const result = repository.list('ranch-1', 'cattle-1', {
      from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-11-12T00:00:00Z'),
    });
    const request = http.expectOne(req => req.url === ranchUrl + '/cattle/cattle-1/livestock-operations');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-01-01T00:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-12T00:00:00.000Z');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('posts a field event to the field-events endpoint without a product or dose', async () => {
    const result = repository.registerFieldEvent('ranch-1', {
      operationId: 'op-1', cattleId: 'cattle-1', type: 'Birth', occurredAt: '2026-11-10T06:00:00.000Z', observation: null,
    });
    const request = http.expectOne(ranchUrl + '/field-events');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      operationId: 'op-1', cattleId: 'cattle-1', type: 'Birth', occurredAt: '2026-11-10T06:00:00.000Z', observation: null,
    });
    request.flush({ operationId: 'op-1' });
    await result;
  });

  it('posts a clinical intervention with its product and dose', async () => {
    const result = repository.registerClinicalIntervention('ranch-1', {
      operationId: 'op-2', cattleId: 'cattle-1', type: 'Vaccination', occurredAt: '2026-11-10T06:00:00.000Z',
      observation: 'Batch 4', product: 'Foot-and-mouth vaccine', dose: '2 ml',
    });
    const request = http.expectOne(ranchUrl + '/clinical-interventions');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ operationId: 'op-2', type: 'Vaccination', product: 'Foot-and-mouth vaccine', dose: '2 ml' });
    request.flush({ operationId: 'op-2' });
    await result;
  });
});
