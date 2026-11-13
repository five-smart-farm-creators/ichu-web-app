import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestPlanningCampaignRepository } from './rest-planning-campaign.repository';

const campaignsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/planning-campaigns';

describe('RestPlanningCampaignRepository', () => {
  let http: HttpTestingController;
  let repository: RestPlanningCampaignRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestPlanningCampaignRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestPlanningCampaignRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the campaigns of a ranch', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(campaignsUrl);

    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('reads one campaign by its identifier', async () => {
    const result = repository.get('ranch-1', 'campaign-1');
    const request = http.expectOne(campaignsUrl + '/campaign-1');

    expect(request.request.method).toBe('GET');
    request.flush({ id: 'campaign-1' });
    expect(await result).toEqual({ id: 'campaign-1' });
  });

  it('creates a campaign with its kind and inclusive days', async () => {
    const result = repository.create('ranch-1', {
      name: 'Spring vaccination', kind: 'Sanitary', startsOn: '2026-11-10', endsOn: '2026-11-12',
    });
    const request = http.expectOne(campaignsUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Spring vaccination', kind: 'Sanitary', startsOn: '2026-11-10', endsOn: '2026-11-12',
    });
    request.flush({ id: 'campaign-1' });
    await result;
  });
});
