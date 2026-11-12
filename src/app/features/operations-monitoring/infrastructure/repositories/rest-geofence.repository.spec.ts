import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestGeofenceRepository } from './rest-geofence.repository';

const geofencesUrl = 'https://api.example.test/api/v1/ranches/ranch-1/geofences';
const triangle = [
  { latitude: -12.1, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.0 },
];

describe('RestGeofenceRepository', () => {
  let http: HttpTestingController;
  let repository: RestGeofenceRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestGeofenceRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestGeofenceRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('defines a geofence for a lot with its boundary as latitude and longitude pairs', async () => {
    const result = repository.define('ranch-1', {
      lotId: 'lot-1', name: 'North', toleranceMeters: 15, severity: 'Warning', vertices: triangle,
    });
    const request = http.expectOne(geofencesUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      lotId: 'lot-1', name: 'North', toleranceMeters: 15, severity: 'Warning', vertices: triangle,
    });
    request.flush({ geofenceId: 'geofence-1' });
    await result;
  });

  it('redefines a geofence without a lot or a revision in the body', async () => {
    const result = repository.redefine('ranch-1', 'geofence-1', {
      name: 'North', toleranceMeters: 20, severity: 'Critical', vertices: triangle,
    });
    const request = http.expectOne(geofencesUrl + '/geofence-1');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'North', toleranceMeters: 20, severity: 'Critical', vertices: triangle });
    request.flush({ geofenceId: 'geofence-1' });
    await result;
  });

  it('lists the geofences of the ranch', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(geofencesUrl);

    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });
});
