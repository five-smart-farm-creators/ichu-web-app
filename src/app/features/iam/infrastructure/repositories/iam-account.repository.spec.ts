import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { IamAccountRepository } from './iam-account.repository';

const account = { id: 'account-id', email: 'rancher@example.test', role: 'RanchManager', status: 'Active', profile: null };
const accountUrl = 'https://api.example.test/api/v1/accounts/me';

describe('IAM account API adapter', () => {
  let http: HttpTestingController;
  let repository: IamAccountRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), IamAccountRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(IamAccountRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the current account from the versioned endpoint', async () => {
    const result = repository.currentAccount();
    const request = http.expectOne(accountUrl);
    expect(request.request.method).toBe('GET');
    request.flush(account);
    expect(await result).toEqual(account);
  });

  it('maps an unauthenticated response to account-unavailable', async () => {
    const result = repository.currentAccount();
    const assertion = expect(result).rejects.toMatchObject({ code: 'account-unavailable' });
    http.expectOne(accountUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
  });

  it('maps an unauthenticated response with the email-not-verified code to email-not-verified', async () => {
    const result = repository.currentAccount();
    const assertion = expect(result).rejects.toMatchObject({ code: 'email-not-verified' });
    http.expectOne(accountUrl).flush({ code: 'email-not-verified' }, { status: 401, statusText: 'Unauthorized' });
    await assertion;
  });

  it('maps ranch details and access codes, and leaves omitted fields empty', async () => {
    const result = repository.ranchAccess();
    http.expectOne('https://api.example.test/api/v1/accounts/me/ranches').flush([
      { ranchId: 'ranch-1', scope: 'Read', expiresAt: null, name: '  North Pasture  ', region: 'Puno', district: 'Melgar' },
      { ranchId: 'ranch-2', scope: 'Manage', expiresAt: '2027-01-31T23:59:59.999Z', accessCode: 'ABCD2345' },
    ]);
    expect(await result).toEqual([
      {
        ranchId: 'ranch-1', scope: 'Read', expiresAt: null, name: 'North Pasture',
        region: 'Puno', district: 'Melgar', accessCode: null,
      },
      {
        ranchId: 'ranch-2', scope: 'Manage', expiresAt: '2027-01-31T23:59:59.999Z', name: null,
        region: null, district: null, accessCode: 'ABCD2345',
      },
    ]);
  });

  it('maps a duplicate account registration to account-unavailable', async () => {
    const result = repository.registerAccount({ role: 'Veterinarian' });
    const assertion = expect(result).rejects.toMatchObject({ code: 'account-unavailable' });
    const request = http.expectOne('https://api.example.test/api/v1/accounts');
    expect(request.request.method).toBe('POST');
    request.flush({}, { status: 409, statusText: 'Conflict' });
    await assertion;
  });
});
