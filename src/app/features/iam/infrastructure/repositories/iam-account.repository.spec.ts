import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { IamAccountRepository } from './iam-account.repository';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { FirebaseAuthRepository } from './firebase-auth.repository';
import { IAM_CONFIG } from '../configuration/iam-config';

const account = { id: 'account-id', email: 'rancher@example.test', role: 'RanchManager', status: 'Active', profile: null };

describe('IAM account API adapter', () => {
  let http: HttpTestingController;
  let repository: IamAccountRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    const identity = { idToken: async () => 'test-id-token', isConfigured: () => true };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), IamAccountRepository,
        { provide: IAM_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
        { provide: AuthenticationRepository, useValue: identity },
        { provide: FirebaseAuthRepository, useValue: identity },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(IamAccountRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('adds an ID token to protected account requests', async () => {
    const result = repository.currentAccount();
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = http.expectOne('https://api.example.test/api/v1/accounts/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-id-token');
    request.flush(account);
    expect(await result).toEqual(account);
  });

  it('uses the anonymous session endpoint before opening a Firebase session', async () => {
    const result = repository.createSession('rancher@example.test', 'test-password');
    const request = http.expectOne('https://api.example.test/api/v1/accounts/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ idToken: 'session-token', tokenType: 'Bearer' });
    expect(await result).toEqual({ idToken: 'session-token', tokenType: 'Bearer' });
  });

  it('maps denied credentials to a safe application error', async () => {
    const result = repository.createSession('rancher@example.test', 'test-password');
    const assertion = expect(result).rejects.toMatchObject({ code: 'invalid-credentials' });
    http.expectOne('https://api.example.test/api/v1/accounts/sessions')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
  });
});
