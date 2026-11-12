import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestTelemetryRepository } from './rest-telemetry.repository';

const telemetryUrl = 'https://api.example.test/api/v1/ranches/ranch-1/cattle/cattle-1/telemetry';

describe('RestTelemetryRepository', () => {
  let http: HttpTestingController;
  let repository: RestTelemetryRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestTelemetryRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestTelemetryRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the latest telemetry of an animal', async () => {
    const result = repository.latest('ranch-1', 'cattle-1');
    const request = http.expectOne(telemetryUrl + '/latest');

    expect(request.request.method).toBe('GET');
    request.flush({ cattleId: 'cattle-1' });
    expect(await result).toEqual({ cattleId: 'cattle-1' });
  });

  it('sends the half-open period and the page in the query string', async () => {
    const from = new Date('2026-11-10T00:00:00Z');
    const to = new Date('2026-11-11T00:00:00Z');
    const result = repository.readings('ranch-1', 'cattle-1', { from, to }, 2, 100);
    const request = http.expectOne(req => req.url === telemetryUrl);

    expect(request.request.params.get('from')).toBe('2026-11-10T00:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-11T00:00:00.000Z');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('100');
    request.flush({ items: [], totalCount: 0 });
    await result;
  });
});
