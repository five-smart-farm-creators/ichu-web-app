import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { iamAuthorizationInterceptor } from './iam-authorization.interceptor';

const apiUrl = 'https://api.example.test/api/v1/accounts/me';

describe('iamAuthorizationInterceptor', () => {
  let http: HttpClient;
  let testing: HttpTestingController;
  let signedIn: boolean;
  const authentication = {
    currentUser: () => (signedIn ? { uid: 'user-1' } : null),
    idToken: vi.fn(async () => 'test-id-token'),
  };

  beforeEach(() => {
    signedIn = true;
    authentication.idToken.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([iamAuthorizationInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
        { provide: AuthenticationRepository, useValue: authentication },
      ],
    });
    http = TestBed.inject(HttpClient);
    testing = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try { testing.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('adds the signed-in Firebase ID token to ICHU API requests', async () => {
    http.get(apiUrl).subscribe();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const request = testing.expectOne(apiUrl);

    expect(request.request.headers.get('Authorization')).toBe('Bearer test-id-token');
    request.flush({});
  });

  it('keeps an Authorization header that the caller already set', () => {
    http.get(apiUrl, { headers: { Authorization: 'Bearer caller-token' } }).subscribe();
    const request = testing.expectOne(apiUrl);

    expect(request.request.headers.get('Authorization')).toBe('Bearer caller-token');
    expect(authentication.idToken).not.toHaveBeenCalled();
    request.flush({});
  });

  it('sends no token when nobody is signed in', () => {
    signedIn = false;
    http.get(apiUrl).subscribe();
    const request = testing.expectOne(apiUrl);

    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('never attaches the token to static files', () => {
    http.get('/i18n/en.json').subscribe();
    const request = testing.expectOne('/i18n/en.json');

    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
