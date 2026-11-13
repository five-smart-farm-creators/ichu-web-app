import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestEdgeGatewayRepository } from './rest-edge-gateway.repository';

const collectionUrl = 'https://api.example.test/api/v1/ranches/ranch-1/edge-gateways';
const gatewayUrl = collectionUrl + '/gateway-1';

describe('RestEdgeGatewayRepository', () => {
  let http: HttpTestingController;
  let repository: RestEdgeGatewayRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestEdgeGatewayRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestEdgeGatewayRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the gateways of the ranch without any key', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'gateway-1', ranchId: 'ranch-1', name: 'North', status: 'Active', registeredAt: '2026-11-01T08:00:00Z', revokedAt: null }]);
    expect((await result)[0]).not.toHaveProperty('key');
  });

  it('registers a gateway and separates its key from the gateway record', async () => {
    const result = repository.register('ranch-1', { name: 'North' });
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'North' });
    request.flush({
      id: 'gateway-1', ranchId: 'ranch-1', name: 'North', status: 'Active', registeredAt: '2026-11-01T08:00:00Z',
      key: 'gateway-1.secret',
    });

    const registration = await result;
    expect(registration.key).toBe('gateway-1.secret');
    expect(registration.gateway).toEqual({
      id: 'gateway-1', ranchId: 'ranch-1', name: 'North', status: 'Active', registeredAt: '2026-11-01T08:00:00Z',
      revokedAt: null,
    });
    expect(registration.gateway).not.toHaveProperty('key');
  });

  it('revokes a gateway with a POST to its revocations and no body', async () => {
    const result = repository.revoke('ranch-1', 'gateway-1');
    const request = http.expectOne(gatewayUrl + '/revocations');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({
      id: 'gateway-1', ranchId: 'ranch-1', name: 'North', status: 'Revoked', registeredAt: '2026-11-01T08:00:00Z',
      revokedAt: '2026-11-11T09:00:00Z',
    });
    expect((await result).status).toBe('Revoked');
  });
});
