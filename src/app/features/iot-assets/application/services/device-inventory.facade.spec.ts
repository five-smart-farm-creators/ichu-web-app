import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade, type CattleSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { DeviceAssignment } from '../../domain/model/device-assignment.model';
import type { Device } from '../../domain/model/device.model';
import type { WaterTrough } from '../../domain/model/water-trough.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { DeviceRepository } from '../../domain/repositories/device.repository';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';
import { DeviceInventoryFacade } from './device-inventory.facade';

const RANCH = 'ranch-1';

function device(serial: string, overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-' + serial, ranchId: RANCH, serial, type: 'SmartCollar', status: 'Available', isAvailable: true,
    communicationStatus: 'NeverReported', lastCommunicationAt: null, lastCommunicationReceivedAt: null,
    batteryPercentage: null, batteryRecordedAt: null, isBatteryLow: null, firmwareVersion: null,
    version: 'version-' + serial, currentAssignment: null, ...overrides,
  };
}

function assignment(targetType: DeviceAssignment['targetType'], targetId: string): DeviceAssignment {
  return {
    id: 'assignment-' + targetId, deviceId: 'device-x', ranchId: RANCH, targetId, targetType,
    startedAt: '2026-11-01T08:00:00Z', endedAt: null, releaseReason: null,
  };
}

function trough(id: string, name: string): WaterTrough {
  return { id, ranchId: RANCH, name, lotId: null, temperatureRange: null, version: 'trough-version-' + id };
}

function animal(cattleId: string, earTag: string, status: CattleSummary['status'] = 'Active'): CattleSummary {
  return { cattleId, earTag, status };
}

describe('DeviceInventoryFacade', () => {
  let facade: DeviceInventoryFacade;
  let deviceRepository: {
    list: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    setMaintenance: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    assignments: ReturnType<typeof vi.fn>;
  };
  let troughRepository: { list: ReturnType<typeof vi.fn> };
  let cattleContext: { cattleSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    deviceRepository = {
      list: vi.fn(async () => [] as Device[]),
      register: vi.fn(),
      setMaintenance: vi.fn(),
      assign: vi.fn(),
      release: vi.fn(),
      assignments: vi.fn(async () => [] as DeviceAssignment[]),
    };
    troughRepository = { list: vi.fn(async () => [] as WaterTrough[]) };
    cattleContext = { cattleSummaries: vi.fn(async () => [] as CattleSummary[]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DeviceInventoryFacade,
        { provide: DeviceRepository, useValue: deviceRepository },
        { provide: WaterTroughRepository, useValue: troughRepository },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(DeviceInventoryFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads devices, troughs and animal labels for the ranch, with devices sorted by serial', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-2'), device('SN-1')]);
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North trough')]);
    cattleContext.cattleSummaries.mockResolvedValue([animal('cattle-1', '101')]);

    await facade.open(RANCH);

    expect(facade.devices().map(item => item.serial)).toEqual(['SN-1', 'SN-2']);
    expect(facade.troughs()).toHaveLength(1);
    expect(deviceRepository.list).toHaveBeenCalledWith(RANCH);
    expect(cattleContext.cattleSummaries).toHaveBeenCalledWith(RANCH);
  });

  it('filters the loaded devices without asking the API again', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-1'), device('SN-2', { type: 'WaterController', status: 'Maintenance' })]);
    await facade.open(RANCH);

    facade.setFilter({ type: 'WaterController' });
    expect(facade.visibleDevices().map(item => item.serial)).toEqual(['SN-2']);

    facade.setFilter({ status: 'Available' });
    expect(facade.visibleDevices().map(item => item.serial)).toEqual(['SN-1']);
    expect(deviceRepository.list).toHaveBeenCalledTimes(1);
  });

  it('offers only active animals that have no collar', async () => {
    deviceRepository.list.mockResolvedValue([
      device('SN-1', { status: 'InService', isAvailable: false, currentAssignment: assignment('Cattle', 'cattle-2') }),
    ]);
    cattleContext.cattleSummaries.mockResolvedValue([
      animal('cattle-1', '101'), animal('cattle-2', '102'), animal('cattle-3', '103', 'Inactive'),
    ]);
    await facade.open(RANCH);

    expect(facade.assignableCattle().map(item => item.earTag)).toEqual(['101']);
  });

  it('offers only troughs that have no controller', async () => {
    deviceRepository.list.mockResolvedValue([
      device('CTRL-1', {
        type: 'WaterController', status: 'InService', isAvailable: false,
        currentAssignment: assignment('WaterTrough', 'trough-1'),
      }),
    ]);
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North'), trough('trough-2', 'South')]);
    await facade.open(RANCH);

    expect(facade.assignableTroughs().map(item => item.name)).toEqual(['South']);
  });

  it('labels an assignment with the ear tag or the trough name, and stays empty for an unknown target', async () => {
    troughRepository.list.mockResolvedValue([trough('trough-1', 'North')]);
    cattleContext.cattleSummaries.mockResolvedValue([animal('cattle-1', '101')]);
    await facade.open(RANCH);

    expect(facade.targetLabel(assignment('Cattle', 'cattle-1'))).toBe('101');
    expect(facade.targetLabel(assignment('WaterTrough', 'trough-1'))).toBe('North');
    expect(facade.targetLabel(assignment('Cattle', 'cattle-gone'))).toBeNull();
  });

  it('assigns a device with the version that was loaded and the chosen target', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-1')]);
    await facade.open(RANCH);
    deviceRepository.assign.mockResolvedValue(device('SN-1', {
      status: 'InService', isAvailable: false, version: 'version-2', currentAssignment: assignment('Cattle', 'cattle-1'),
    }));

    await facade.assign('device-SN-1', 'cattle-1');

    expect(deviceRepository.assign).toHaveBeenCalledWith(RANCH, 'device-SN-1', {
      targetId: 'cattle-1', expectedVersion: 'version-SN-1',
    });
    expect(facade.devices()[0].version).toBe('version-2');
  });

  it('releases a device only with a reason, and sends the reason trimmed', async () => {
    deviceRepository.list.mockResolvedValue([
      device('SN-1', { status: 'InService', isAvailable: false, currentAssignment: assignment('Cattle', 'cattle-1') }),
    ]);
    await facade.open(RANCH);
    deviceRepository.release.mockResolvedValue(device('SN-1', { version: 'version-2' }));

    await expect(facade.release('device-SN-1', '   ')).rejects.toMatchObject({ status: 400 });
    expect(deviceRepository.release).not.toHaveBeenCalled();

    await facade.release('device-SN-1', '  Lost collar  ');
    expect(deviceRepository.release).toHaveBeenCalledWith(RANCH, 'device-SN-1', {
      reason: 'Lost collar', expectedVersion: 'version-SN-1',
    });
  });

  it('turns maintenance on and off, each time with the version the last change returned', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-1')]);
    await facade.open(RANCH);

    deviceRepository.setMaintenance.mockResolvedValueOnce(device('SN-1', { status: 'Maintenance', version: 'version-2' }));
    await facade.setMaintenance('device-SN-1', true);
    expect(deviceRepository.setMaintenance).toHaveBeenLastCalledWith(RANCH, 'device-SN-1', {
      inMaintenance: true, expectedVersion: 'version-SN-1',
    });
    expect(facade.devices()[0].status).toBe('Maintenance');

    deviceRepository.setMaintenance.mockResolvedValueOnce(device('SN-1', { version: 'version-3' }));
    await facade.setMaintenance('device-SN-1', false);
    expect(deviceRepository.setMaintenance).toHaveBeenLastCalledWith(RANCH, 'device-SN-1', {
      inMaintenance: false, expectedVersion: 'version-2',
    });
  });

  it('reloads the inventory after a version conflict and passes the conflict to the caller', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-1')]);
    await facade.open(RANCH);
    deviceRepository.assign.mockRejectedValue(new ApiError(409, VERSION_CONFLICT, null));

    await expect(facade.assign('device-SN-1', 'cattle-1')).rejects.toMatchObject({ code: VERSION_CONFLICT });
    expect(deviceRepository.list).toHaveBeenCalledTimes(2);
  });

  it('registers a device and lists it in serial order without reloading the inventory', async () => {
    deviceRepository.list.mockResolvedValue([device('SN-2')]);
    await facade.open(RANCH);
    deviceRepository.register.mockResolvedValue(device('SN-1'));

    await facade.register({ serial: 'SN-1', type: 'SmartCollar' });

    expect(deviceRepository.register).toHaveBeenCalledWith(RANCH, { serial: 'SN-1', type: 'SmartCollar' });
    expect(facade.devices().map(item => item.serial)).toEqual(['SN-1', 'SN-2']);
    expect(deviceRepository.list).toHaveBeenCalledTimes(1);
  });
});
