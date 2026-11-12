import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestReproductiveHistoryRepository } from './rest-reproductive-history.repository';

const historyUrl = 'https://api.example.test/api/v1/ranches/ranch-1/cattle/cattle-1/reproductive-history';

describe('RestReproductiveHistoryRepository', () => {
  let http: HttpTestingController;
  let repository: RestReproductiveHistoryRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestReproductiveHistoryRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestReproductiveHistoryRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the reproductive history of an animal and returns it as the API sends it', async () => {
    const result = repository.get('ranch-1', 'cattle-1');
    const request = http.expectOne(historyUrl);
    const body = {
      cattleId: 'cattle-1', sex: 'Female', lifeStage: 'MilkingCow', ageInMonths: 48, hasHistory: false,
      services: [], pregnancyDiagnoses: [], calvings: [], abortions: [], heatsObserved: [], intervals: [],
      servicesPerPregnancy: null, pregnanciesConfirmed: 0,
    };

    expect(request.request.method).toBe('GET');
    request.flush(body);
    expect(await result).toEqual(body);
  });

  it('reports a failed read as an API error that keeps the problem code', async () => {
    const result = repository.get('ranch-1', 'cattle-1');
    const request = http.expectOne(historyUrl);

    request.flush({ code: 'OperationsMonitoring.AnimalNotFound', title: 'Animal not found.' }, { status: 404, statusText: 'Not Found' });

    await expect(result).rejects.toMatchObject({ status: 404, code: 'OperationsMonitoring.AnimalNotFound', title: 'Animal not found.' });
  });
});
