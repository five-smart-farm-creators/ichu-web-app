import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { Cattle } from '../../domain/model/cattle.model';
import { RestCattleRepository } from './rest-cattle.repository';

const collectionUrl = 'https://api.example.test/api/v1/ranches/ranch-1/cattle';
const animalUrl = collectionUrl + '/cattle-1';

function cattle(overrides: Partial<Cattle> = {}): Cattle {
  return {
    id: 'cattle-1', ranchId: 'ranch-1', earTag: '101', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10',
    currentStage: 'Calf', status: 'Active', exitReason: null, exitDate: null, version: 'version-1', stagePeriods: [],
    ...overrides,
  };
}

describe('RestCattleRepository', () => {
  let http: HttpTestingController;
  let repository: RestCattleRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestCattleRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestCattleRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists one page under the ranch and sends only the filters that are set', async () => {
    const result = repository.list('ranch-1', { status: 'Active', lotId: 'lot-1' }, 2, 25);
    const request = http.expectOne(req => req.url === collectionUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('25');
    expect(request.request.params.get('status')).toBe('Active');
    expect(request.request.params.get('lotId')).toBe('lot-1');
    expect(request.request.params.has('earTag')).toBe(false);
    request.flush([cattle()]);
    expect(await result).toEqual([cattle()]);
  });

  it('sends the ear tag as an exact filter when one is given', async () => {
    const result = repository.list('ranch-1', { earTag: '101' }, 1, 50);
    const request = http.expectOne(req => req.url === collectionUrl);

    expect(request.request.params.get('earTag')).toBe('101');
    expect(request.request.params.has('status')).toBe(false);
    request.flush([]);
    await result;
  });

  it('reads an animal profile with its collar status', async () => {
    const result = repository.profile('ranch-1', 'cattle-1');
    const request = http.expectOne(animalUrl);

    expect(request.request.method).toBe('GET');
    request.flush({ cattle: cattle(), device: { isAvailable: true, collarId: null, lastReadingReceivedAt: null } });
    expect((await result).device.isAvailable).toBe(true);
  });

  it('registers an animal with enum names as text', async () => {
    const request = { earTag: '101', breed: 'Criollo' as const, sex: 'Female' as const, birthDate: '2025-01-10', lifeStage: 'Calf' as const };
    const result = repository.register('ranch-1', request);
    const call = http.expectOne(collectionUrl);

    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush(cattle());
    await result;
  });

  it('sends the expected version with an update', async () => {
    const result = repository.update('ranch-1', 'cattle-1', {
      earTag: '202', breed: 'Fleckvieh', sex: 'Male', birthDate: '2025-01-10', expectedVersion: 'version-1',
    });
    const request = http.expectOne(animalUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      earTag: '202', breed: 'Fleckvieh', sex: 'Male', birthDate: '2025-01-10', expectedVersion: 'version-1',
    });
    request.flush(cattle({ earTag: '202' }));
    await result;
  });

  it('changes the life stage at its own endpoint with the effective date and version', async () => {
    const result = repository.changeLifeStage('ranch-1', 'cattle-1', {
      lifeStage: 'Heifer', validFrom: '2026-06-01', expectedVersion: 'version-1',
    });
    const request = http.expectOne(animalUrl + '/life-stage');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ lifeStage: 'Heifer', validFrom: '2026-06-01', expectedVersion: 'version-1' });
    request.flush(cattle({ currentStage: 'Heifer' }));
    await result;
  });

  it('records an exit at the deactivation endpoint with its reason, date and version', async () => {
    const result = repository.recordExit('ranch-1', 'cattle-1', {
      reason: 'Sale', exitDate: '2026-11-01', expectedVersion: 'version-1',
    });
    const request = http.expectOne(animalUrl + '/deactivations');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Sale', exitDate: '2026-11-01', expectedVersion: 'version-1' });
    request.flush(cattle({ status: 'Inactive', exitReason: 'Sale', exitDate: '2026-11-01' }));
    await result;
  });

  it('reports a stale animal under the shared version conflict code', async () => {
    const result = repository.update('ranch-1', 'cattle-1', {
      earTag: '101', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10', expectedVersion: 'version-0',
    });
    const assertion = expect(result).rejects.toMatchObject({ status: 409, code: 'version-conflict' });
    http.expectOne(animalUrl).flush(
      { code: 'CattleInformation.CattleVersionMismatch', title: 'Changed.' },
      { status: 409, statusText: 'Conflict' },
    );
    await assertion;
  });

  it('keeps other conflicts with their backend code and title', async () => {
    const result = repository.register('ranch-1', {
      earTag: '101', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10', lifeStage: 'Calf',
    });
    const assertion = expect(result).rejects.toMatchObject({
      status: 409, code: 'CattleInformation.DuplicateEarTag', title: 'Ear tag in use.',
    });
    http.expectOne(collectionUrl).flush(
      { code: 'CattleInformation.DuplicateEarTag', title: 'Ear tag in use.' },
      { status: 409, statusText: 'Conflict' },
    );
    await assertion;
  });
});
