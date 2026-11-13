import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import type { Device } from '../../domain/model/device.model';
import { RestDeviceRepository } from './rest-device.repository';

const collectionUrl = 'https://api.example.test/api/v1/ranches/ranch-1/devices';
const deviceUrl = collectionUrl + '/device-1';

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1', ranchId: 'ranch-1', serial: 'SN-1', type: 'SmartCollar', status: 'Available', isAvailable: true,
    communicationStatus: 'NeverReported', lastCommunicationAt: null, lastCommunicationReceivedAt: null,
    batteryPercentage: null, batteryRecordedAt: null, isBatteryLow: null, firmwareVersion: null, version: 'v1',
    currentAssignment: null, ...overrides,
  };
}

describe('RestDeviceRepository', () => {
  let http: HttpTestingController;
  let repository: RestDeviceRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestDeviceRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestDeviceRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('lists the devices of the ranch with one GET', async () => {
    const result = repository.list('ranch-1');
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('GET');
    request.flush([device()]);
    expect(await result).toEqual([device()]);
  });

  it('registers a device with its serial, type and firmware', async () => {
    const result = repository.register('ranch-1', { serial: 'SN-2', type: 'WaterController', firmwareVersion: '2.1' });
    const request = http.expectOne(collectionUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ serial: 'SN-2', type: 'WaterController', firmwareVersion: '2.1' });
    request.flush(device({ serial: 'SN-2' }));
    await result;
  });

  it('sends the maintenance flag with the version that was read', async () => {
    const result = repository.setMaintenance('ranch-1', 'device-1', { inMaintenance: true, expectedVersion: 'v1' });
    const request = http.expectOne(deviceUrl + '/maintenance');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ inMaintenance: true, expectedVersion: 'v1' });
    request.flush(device());
    await result;
  });

  it('assigns a device to a target and releases it with a reason, each with the device version', async () => {
    const assigned = repository.assign('ranch-1', 'device-1', { targetId: 'cattle-1', expectedVersion: 'v1' });
    const assignCall = http.expectOne(deviceUrl + '/assignments');

    expect(assignCall.request.method).toBe('POST');
    expect(assignCall.request.body).toEqual({ targetId: 'cattle-1', expectedVersion: 'v1' });
    assignCall.flush(device());
    await assigned;

    const released = repository.release('ranch-1', 'device-1', { reason: 'Collar lost', expectedVersion: 'v2' });
    const releaseCall = http.expectOne(deviceUrl + '/releases');

    expect(releaseCall.request.method).toBe('POST');
    expect(releaseCall.request.body).toEqual({ reason: 'Collar lost', expectedVersion: 'v2' });
    releaseCall.flush(device());
    await released;
  });

  it('reads the assignment history of one device', async () => {
    const result = repository.assignments('ranch-1', 'device-1');
    const request = http.expectOne(deviceUrl + '/assignments');

    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('reports a stale device as the shared version conflict', async () => {
    const result = repository.setMaintenance('ranch-1', 'device-1', { inMaintenance: false, expectedVersion: 'old' });
    http.expectOne(deviceUrl + '/maintenance').flush(
      { code: 'IoTAssets.Conflict', title: 'The record changed.' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(result).rejects.toMatchObject({ status: 409, code: 'version-conflict' });
  });
});
