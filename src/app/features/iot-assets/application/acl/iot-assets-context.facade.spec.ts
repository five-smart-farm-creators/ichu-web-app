import { TestBed } from '@angular/core/testing';
import type { Device } from '../../domain/model/device.model';
import { DeviceRepository } from '../../domain/repositories/device.repository';
import { IotAssetsContextFacade } from './iot-assets-context.facade';

function device(id: string, overrides: Partial<Device> = {}): Device {
  return {
    id, ranchId: 'ranch-1', serial: `SN-${id}`, type: 'SmartCollar', status: 'InService', isAvailable: false,
    communicationStatus: 'Communicating', lastCommunicationAt: null, lastCommunicationReceivedAt: null,
    batteryPercentage: 80, batteryRecordedAt: null, isBatteryLow: false, firmwareVersion: '1.0.0', version: 'v1',
    currentAssignment: null, ...overrides,
  };
}

describe('IotAssetsContextFacade', () => {
  let facade: IotAssetsContextFacade;
  let devices: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    devices = { list: vi.fn(async () => [] as Device[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [IotAssetsContextFacade, { provide: DeviceRepository, useValue: devices }],
    });
    facade = TestBed.inject(IotAssetsContextFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('counts the collars by communication status and leaves the water controllers out', async () => {
    devices.list.mockResolvedValue([
      device('collar-1', { communicationStatus: 'Communicating' }),
      device('collar-2', { communicationStatus: 'Communicating' }),
      device('collar-3', { communicationStatus: 'NoCommunication' }),
      device('collar-4', { communicationStatus: 'NeverReported' }),
      device('trough-1', { type: 'WaterController', communicationStatus: 'NoCommunication' }),
    ]);

    expect(await facade.collarConnectivity('ranch-1')).toEqual({
      communicating: 2, noCommunication: 1, neverReported: 1, lowBattery: 0,
    });
  });

  it('counts only the collars whose battery is reported low', async () => {
    devices.list.mockResolvedValue([
      device('collar-1', { isBatteryLow: true }),
      device('collar-2', { isBatteryLow: null }),
      device('collar-3', { isBatteryLow: false }),
      device('trough-1', { type: 'WaterController', isBatteryLow: true }),
    ]);

    expect((await facade.collarConnectivity('ranch-1')).lowBattery).toBe(1);
  });

  it('reads the devices of the ranch', async () => {
    await facade.collarConnectivity('ranch-1');

    expect(devices.list).toHaveBeenCalledWith('ranch-1');
  });
});
