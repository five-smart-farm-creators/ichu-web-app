import { assignmentTargetOf, type Device, matchesDeviceFilter } from './device.model';

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1', ranchId: 'ranch-1', serial: 'SN-1', type: 'SmartCollar', status: 'Available', isAvailable: true,
    communicationStatus: 'Communicating', lastCommunicationAt: null, lastCommunicationReceivedAt: null,
    batteryPercentage: 80, batteryRecordedAt: null, isBatteryLow: false, firmwareVersion: '1.0.0', version: 'v1',
    currentAssignment: null, ...overrides,
  };
}

describe('device model', () => {
  it('serves animals with collars and troughs with water controllers', () => {
    expect(assignmentTargetOf('SmartCollar')).toBe('Cattle');
    expect(assignmentTargetOf('WaterController')).toBe('WaterTrough');
  });

  it('matches a device only against the filters that are set', () => {
    const collar = device({ status: 'InService', communicationStatus: 'NoCommunication' });

    expect(matchesDeviceFilter(collar, {})).toBe(true);
    expect(matchesDeviceFilter(collar, { type: 'SmartCollar', status: 'InService' })).toBe(true);
    expect(matchesDeviceFilter(collar, { type: 'WaterController' })).toBe(false);
    expect(matchesDeviceFilter(collar, { communication: 'Communicating' })).toBe(false);
  });
});
