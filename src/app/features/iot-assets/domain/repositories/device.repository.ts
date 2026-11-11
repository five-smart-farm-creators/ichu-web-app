import type { DeviceAssignment } from '../model/device-assignment.model';
import type { AssignDevice, Device, RegisterDevice, ReleaseDevice, SetDeviceMaintenance } from '../model/device.model';

/** Defines device operations backed by the IoT devices REST API; every call is scoped to one ranch. */
export abstract class DeviceRepository {
  abstract list(ranchId: string): Promise<readonly Device[]>;
  abstract register(ranchId: string, request: RegisterDevice): Promise<Device>;
  abstract setMaintenance(ranchId: string, deviceId: string, request: SetDeviceMaintenance): Promise<Device>;
  abstract assign(ranchId: string, deviceId: string, request: AssignDevice): Promise<Device>;
  abstract release(ranchId: string, deviceId: string, request: ReleaseDevice): Promise<Device>;
  abstract assignments(ranchId: string, deviceId: string): Promise<readonly DeviceAssignment[]>;
}
