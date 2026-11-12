import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { TrendQuery } from '../../domain/model/lot-trend.model';
import { RestLotTrendRepository } from './rest-lot-trend.repository';

const trendsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/trends';
const comparisonUrl = 'https://api.example.test/api/v1/ranches/ranch-1/trends/cattle/cattle-1/comparison';

const query: TrendQuery = {
  lotId: 'lot-1',
  period: { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') },
  metric: 'body-temperature',
  deviation: 0.75,
};

describe('RestLotTrendRepository', () => {
  let http: HttpTestingController;
  let repository: RestLotTrendRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestLotTrendRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestLotTrendRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('sends the lot, metric, deviation and half-open period of a trend', async () => {
    const result = repository.lotTrend('ranch-1', query);
    const request = http.expectOne(req => req.url === trendsUrl);

    expect(request.request.params.get('lotId')).toBe('lot-1');
    expect(request.request.params.get('metric')).toBe('body-temperature');
    expect(request.request.params.get('deviation')).toBe('0.75');
    expect(request.request.params.get('from')).toBe('2026-10-12T05:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-12T05:00:00.000Z');
    request.flush({ lotId: 'lot-1' });
    expect(await result).toEqual({ lotId: 'lot-1' });
  });

  it('reads one animal against its lot with the same query values', async () => {
    const result = repository.animalComparison('ranch-1', 'cattle-1', query);
    const request = http.expectOne(req => req.url === comparisonUrl);

    expect(request.request.params.get('lotId')).toBe('lot-1');
    expect(request.request.params.get('deviation')).toBe('0.75');
    request.flush({ cattleId: 'cattle-1' });
    expect(await result).toEqual({ cattleId: 'cattle-1' });
  });
});
