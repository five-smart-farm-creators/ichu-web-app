import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestExecutiveReportRepository } from './rest-executive-report.repository';

const reportUrl = 'https://api.example.test/api/v1/ranches/ranch-1/reports/executive';
const period = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

describe('RestExecutiveReportRepository', () => {
  let http: HttpTestingController;
  let repository: RestExecutiveReportRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestExecutiveReportRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestExecutiveReportRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('requests the JSON document of the period', async () => {
    const result = repository.document('ranch-1', period);
    const request = http.expectOne(req => req.url === reportUrl);

    expect(request.request.params.get('format')).toBe('json');
    expect(request.request.params.get('from')).toBe('2026-10-12T05:00:00.000Z');
    request.flush({ generatedAt: '2026-11-12T00:00:00Z', indicators: {} });
    expect(await result).toEqual({ generatedAt: '2026-11-12T00:00:00Z', indicators: {} });
  });

  it('downloads the CSV as a blob', async () => {
    const result = repository.csv('ranch-1', period);
    const request = http.expectOne(req => req.url === reportUrl);

    expect(request.request.params.get('format')).toBe('csv');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['Metric\r\n'], { type: 'text/csv' }));
    expect((await result).content.size).toBeGreaterThan(0);
  });
});
