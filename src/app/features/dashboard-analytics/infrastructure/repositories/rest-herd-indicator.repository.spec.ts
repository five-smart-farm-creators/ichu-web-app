import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestHerdIndicatorRepository } from './rest-herd-indicator.repository';

const dashboardUrl = 'https://api.example.test/api/v1/ranches/ranch-1/dashboard';

describe('RestHerdIndicatorRepository', () => {
  let http: HttpTestingController;
  let repository: RestHerdIndicatorRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestHerdIndicatorRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestHerdIndicatorRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the dashboard of the period as half-open ISO instants', async () => {
    const result = repository.dashboard('ranch-1', {
      from: new Date('2026-10-12T05:00:00Z'),
      to: new Date('2026-11-12T05:00:00Z'),
    });
    const request = http.expectOne(req => req.url === dashboardUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-12T05:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-12T05:00:00.000Z');
    request.flush({ ranchId: 'ranch-1' });
    expect(await result).toEqual({ ranchId: 'ranch-1' });
  });
});
