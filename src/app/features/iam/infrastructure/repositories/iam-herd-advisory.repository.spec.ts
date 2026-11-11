import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { IamHerdAdvisoryRepository } from './iam-herd-advisory.repository';

const advisoriesUrl = 'https://api.example.test/api/v1/ranches/ranch-1/herd-advisories';

describe('IAM herd advisory API adapter', () => {
  let http: HttpTestingController;
  let repository: IamHerdAdvisoryRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), IamHerdAdvisoryRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(IamHerdAdvisoryRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists advisories under the ranch path', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(advisoriesUrl);
    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('posts a request body that contains only the reason', async () => {
    const result = repository.request('ranch-1', { reason: 'Vaccine review' });
    const request = http.expectOne(advisoriesUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Vaccine review' });
    request.flush({ id: 'advisory-1' });
    await result;
  });

  it('patches a decision on an advisory inside the ranch path', async () => {
    const decision = { decision: 'grant' as const, scope: 'Read' as const, expiresAt: '2027-01-31T23:59:59.999Z' };
    const result = repository.decide('ranch-1', 'advisory-1', decision);
    const request = http.expectOne(advisoriesUrl + '/advisory-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(decision);
    request.flush({ id: 'advisory-1' });
    await result;
  });
});
