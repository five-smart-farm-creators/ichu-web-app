import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestAlertRepository } from './rest-alert.repository';

const alertsUrl = 'https://api.example.test/api/v1/ranches/ranch-1/alerts';

describe('RestAlertRepository', () => {
  let http: HttpTestingController;
  let repository: RestAlertRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestAlertRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestAlertRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists alerts with the status and animal filters only when they are set', async () => {
    const result = repository.list('ranch-1', { status: 'Pending', cattleId: null }, 1, 25);
    const request = http.expectOne(req => req.url === alertsUrl);

    expect(request.request.params.get('status')).toBe('Pending');
    expect(request.request.params.has('cattleId')).toBe(false);
    expect(request.request.params.get('pageSize')).toBe('25');
    request.flush({ page: 1, pageSize: 25, totalCount: 0, items: [] });
    await result;
  });

  it('acknowledges an alert with the operation ID, the finding, the action and the version read', async () => {
    const result = repository.acknowledge('ranch-1', 'alert-1', {
      operationId: 'op-1', finding: 'Checked the animal', action: null, expectedVersion: 3,
    });
    const request = http.expectOne(alertsUrl + '/alert-1');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      status: 'Acknowledged', finding: 'Checked the animal', action: null, operationId: 'op-1', expectedVersion: 3,
    });
    request.flush({ alertId: 'alert-1', version: 4 });
    expect(await result).toEqual({ alertId: 'alert-1', version: 4 });
  });

  it('reports a 409 answer under the shared version conflict code so the screen reloads', async () => {
    const result = repository.acknowledge('ranch-1', 'alert-1', {
      operationId: 'op-2', finding: 'Checked', action: 'Moved', expectedVersion: 2,
    });
    const assertion = expect(result).rejects.toMatchObject({ status: 409, code: 'version-conflict' });
    http.expectOne(alertsUrl + '/alert-1').flush({ alertId: 'alert-1' }, { status: 409, statusText: 'Conflict' });

    await assertion;
  });
});
