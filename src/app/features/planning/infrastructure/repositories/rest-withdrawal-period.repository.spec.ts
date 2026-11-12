import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestWithdrawalPeriodRepository } from './rest-withdrawal-period.repository';

const periodsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/withdrawal-periods';

describe('RestWithdrawalPeriodRepository', () => {
  let http: HttpTestingController;
  let repository: RestWithdrawalPeriodRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestWithdrawalPeriodRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestWithdrawalPeriodRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists every period of the ranch when no animal is named', async () => {
    const result = repository.list('ranch-1', null);
    const request = http.expectOne(req => req.url === periodsUrl);

    expect(request.request.params.has('cattleId')).toBe(false);
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('narrows the list to one animal with the cattleId query parameter', async () => {
    const result = repository.list('ranch-1', 'cattle-1');
    const request = http.expectOne(req => req.url === periodsUrl);

    expect(request.request.params.get('cattleId')).toBe('cattle-1');
    request.flush([]);
    await result;
  });

  it('records a period with its explicit bounds and optional intervention', async () => {
    const result = repository.record('ranch-1', {
      cattleId: 'cattle-1', interventionId: null, startsAt: '2026-11-10T00:00:00.000Z', endsAt: '2026-11-13T00:00:00.000Z',
    });
    const request = http.expectOne(periodsUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      cattleId: 'cattle-1', interventionId: null, startsAt: '2026-11-10T00:00:00.000Z', endsAt: '2026-11-13T00:00:00.000Z',
    });
    request.flush({ id: 'period-1' });
    await result;
  });
});
