import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { WaterTrough } from '../../domain/model/water-trough.model';
import { RestWaterTroughRepository } from './rest-water-trough.repository';

const collectionUrl = 'https://api.example.test/api/v1/ranches/ranch-1/water-troughs';

function trough(overrides: Partial<WaterTrough> = {}): WaterTrough {
  return {
    id: 'trough-1', ranchId: 'ranch-1', name: 'North trough', lotId: null, temperatureRange: null, version: 'v1',
    ...overrides,
  };
}

describe('RestWaterTroughRepository', () => {
  let http: HttpTestingController;
  let repository: RestWaterTroughRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestWaterTroughRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestWaterTroughRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the water troughs of the ranch', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('GET');
    request.flush([trough()]);
    expect(await result).toEqual([trough()]);
  });

  it('registers a trough with its name and only the lot that was chosen', async () => {
    const result = repository.register('ranch-1', { name: 'South trough' });
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'South trough' });
    request.flush(trough({ name: 'South trough' }));
    await result;
  });

  it('saves the temperature band with the trough version that was read', async () => {
    const result = repository.configureTemperatureRange('ranch-1', 'trough-1', {
      minimumCelsius: 12.5, maximumCelsius: 24, expectedVersion: 'v1',
    });
    const request = http.expectOne(collectionUrl + '/trough-1/temperature-range');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ minimumCelsius: 12.5, maximumCelsius: 24, expectedVersion: 'v1' });
    request.flush(trough());
    await result;
  });
});
