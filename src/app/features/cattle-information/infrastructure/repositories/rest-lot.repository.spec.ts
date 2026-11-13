import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestLotRepository } from './rest-lot.repository';

const lotsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/lots';
const membershipUrl = lotsUrl + '/lot-1/cattle/cattle-1';

describe('RestLotRepository', () => {
  let http: HttpTestingController;
  let repository: RestLotRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestLotRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestLotRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the lots of a ranch', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(lotsUrl);

    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('creates a lot and omits the criterion when none is given', async () => {
    const result = repository.create('ranch-1', { name: 'Calves' });
    const request = http.expectOne(lotsUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Calves' });
    request.flush({ id: 'lot-1' });
    await result;
  });

  it('sends the lot version in the body when it assigns an animal', async () => {
    const result = repository.assignCattle('ranch-1', 'lot-1', 'cattle-1', 'lot-version-1');
    const request = http.expectOne(membershipUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedVersion: 'lot-version-1' });
    request.flush({ id: 'lot-1' });
    await result;
  });

  it('sends the lot version as a query parameter when it removes an animal', async () => {
    const result = repository.removeCattle('ranch-1', 'lot-1', 'cattle-1', 'lot-version-1');
    const request = http.expectOne(req => req.url === membershipUrl);

    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('expectedVersion')).toBe('lot-version-1');
    request.flush({ id: 'lot-1' });
    await result;
  });

  it('reports a stale lot under the shared version conflict code', async () => {
    const result = repository.assignCattle('ranch-1', 'lot-1', 'cattle-1', 'lot-version-0');
    const assertion = expect(result).rejects.toMatchObject({ status: 409, code: 'version-conflict' });
    http.expectOne(membershipUrl).flush(
      { code: 'CattleInformation.LotVersionMismatch', title: 'Changed.' },
      { status: 409, statusText: 'Conflict' },
    );
    await assertion;
  });
});
