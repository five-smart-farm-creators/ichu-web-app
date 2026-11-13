import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { IamRanchDirectoryRepository } from './iam-ranch-directory.repository';

const ranchesUrl = 'https://api.example.test/api/v1/ranches';

describe('IAM ranch directory API adapter', () => {
  let http: HttpTestingController;
  let repository: IamRanchDirectoryRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), IamRanchDirectoryRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(IamRanchDirectoryRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('sends the trimmed, upper-cased access code as a query parameter', async () => {
    const result = repository.findByAccessCode('  abcd2345 ');
    const request = http.expectOne(`${ranchesUrl}?accessCode=ABCD2345`);
    expect(request.request.method).toBe('GET');
    request.flush({ ranchId: 'ranch-1', name: ' North Pasture ', region: 'Puno', district: null });
    expect(await result).toEqual({ ranchId: 'ranch-1', name: 'North Pasture', region: 'Puno', district: null });
  });

  it('resolves an unknown code to null', async () => {
    const result = repository.findByAccessCode('ZZZZ9999');
    http.expectOne(`${ranchesUrl}?accessCode=ZZZZ9999`).flush(
      { code: 'ranch-not-found' }, { status: 404, statusText: 'Not Found' },
    );
    expect(await result).toBeNull();
  });

  it('reports a lookup that the account may not make as an ApiError', async () => {
    const result = repository.findByAccessCode('ABCD2345');
    const assertion = expect(result).rejects.toMatchObject({ status: 403, code: 'http-403' });
    http.expectOne(`${ranchesUrl}?accessCode=ABCD2345`).flush({}, { status: 403, statusText: 'Forbidden' });
    await assertion;
  });
});
