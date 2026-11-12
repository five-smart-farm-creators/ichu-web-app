import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestMonitoringThresholdRepository } from './rest-monitoring-threshold.repository';

const thresholdsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/monitoring-thresholds';

describe('RestMonitoringThresholdRepository', () => {
  let http: HttpTestingController;
  let repository: RestMonitoringThresholdRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestMonitoringThresholdRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestMonitoringThresholdRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the thresholds of the ranch', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(thresholdsUrl);

    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('configures a stage and metric with both limits and the severity', async () => {
    const body = { lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38, maxValue: 39.5, severity: 'Warning' } as const;
    const result = repository.configure('ranch-1', body);
    const request = http.expectOne(thresholdsUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ thresholdId: 'threshold-1' });
    await result;
  });
});
