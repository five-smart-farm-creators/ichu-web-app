import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestRanchPortfolioRepository } from './rest-ranch-portfolio.repository';

describe('RestRanchPortfolioRepository', () => {
  let http: HttpTestingController;
  let repository: RestRanchPortfolioRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestRanchPortfolioRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestRanchPortfolioRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the portfolio of the accessible ranches without a ranch in the URL', async () => {
    const result = repository.list();
    const request = http.expectOne('https://api.example.test/api/v1/analytics/portfolio');

    expect(request.request.method).toBe('GET');
    request.flush([{ ranchId: 'ranch-1' }]);
    expect(await result).toEqual([{ ranchId: 'ranch-1' }]);
  });
});
