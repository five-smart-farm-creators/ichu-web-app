import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { WaterReading, WaterTroughStatus } from '../../domain/model/water-status.model';
import { RestWaterStatusRepository } from './rest-water-status.repository';

const statusesUrl = 'https://api.example.test/api/v1/ranches/ranch-1/water-troughs/status';
const readingsUrl = 'https://api.example.test/api/v1/water-controllers/controller-1/readings';

function reading(overrides: Partial<WaterReading> = {}): WaterReading {
  return {
    id: 'row-1', readingId: 'reading-1', controllerId: 'controller-1', waterTroughId: 'trough-1', ranchId: 'ranch-1',
    gatewayId: 'gateway-1', temperature: 0, temperatureUnit: 'Celsius', isValid: false, heaterState: 'On',
    capturedAt: '2026-11-14T10:00:00.000000Z', receivedAt: '2026-11-14T10:00:02.000000Z', origin: 'EdgeGateway',
    ...overrides,
  };
}

function status(overrides: Partial<WaterTroughStatus> = {}): WaterTroughStatus {
  return {
    waterTroughId: 'trough-1', name: 'North trough', lotId: null, minimumCelsius: 12, maximumCelsius: 24,
    controllerStatus: 'Communicating', controllerId: 'controller-1', controllerAssignedAt: '2026-11-01T00:00:00.000000Z',
    lastCommunicationAt: '2026-11-14T10:00:02.000000Z', measurementStatus: 'Valid', rangeStatus: 'WithinRange',
    latestReading: null, evaluatedAt: '2026-11-14T10:05:00.000000Z', ...overrides,
  };
}

describe('RestWaterStatusRepository', () => {
  let http: HttpTestingController;
  let repository: RestWaterStatusRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestWaterStatusRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestWaterStatusRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('unwraps the status items of the ranch in the order the API returns them', async () => {
    const result = repository.troughStatuses('ranch-1');
    const request = http.expectOne(statusesUrl);

    expect(request.request.method).toBe('GET');
    request.flush({
      ranchId: 'ranch-1',
      items: [
        status({ latestReading: reading() }),
        status({
          waterTroughId: 'trough-2', name: 'South trough', lotId: 'lot-1', minimumCelsius: null, maximumCelsius: null,
          controllerStatus: 'NoController', controllerId: null, controllerAssignedAt: null, lastCommunicationAt: null,
          measurementStatus: 'Unavailable', rangeStatus: 'NotConfigured',
        }),
      ],
    });
    expect(await result).toEqual([
      status({ latestReading: reading() }),
      status({
        waterTroughId: 'trough-2', name: 'South trough', lotId: 'lot-1', minimumCelsius: null, maximumCelsius: null,
        controllerStatus: 'NoController', controllerId: null, controllerAssignedAt: null, lastCommunicationAt: null,
        measurementStatus: 'Unavailable', rangeStatus: 'NotConfigured',
      }),
    ]);
  });

  it('sends the half-open period with microsecond precision and the page in the query string', async () => {
    const result = repository.readings('controller-1', {
      from: new Date('2026-11-13T00:00:00.000Z'), to: new Date('2026-11-14T00:00:00.000Z'),
    }, 1, 500);
    const request = http.expectOne(req => req.url === readingsUrl);

    expect(request.request.params.get('from')).toBe('2026-11-13T00:00:00.000000Z');
    expect(request.request.params.get('to')).toBe('2026-11-14T00:00:00.000000Z');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('500');
    request.flush({
      controllerId: 'controller-1', from: '2026-11-13T00:00:00.000000Z', to: '2026-11-14T00:00:00.000000Z',
      page: 1, pageSize: 500, totalCount: 0, items: [],
    });
    await result;
  });
});
