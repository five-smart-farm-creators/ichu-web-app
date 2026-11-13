import type { AssignmentTargetType, DeviceAssignment } from './device-assignment.model';

/** Device families; the type decides what the device can be assigned to. */
export const DEVICE_TYPES = ['SmartCollar', 'WaterController'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_STATUSES = ['Available', 'InService', 'Maintenance'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

/** Derived by the API from the last communication; the screens only display it. */
export const COMMUNICATION_STATUSES = ['NeverReported', 'Communicating', 'NoCommunication'] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const DEVICE_SERIAL_MAX_LENGTH = 50;
export const FIRMWARE_VERSION_MAX_LENGTH = 20;
export const RELEASE_REASON_MAX_LENGTH = 120;

/** A collar or water controller of a ranch; `version` must accompany every change to it. */
export interface Device {
  readonly id: string;
  readonly ranchId: string;
  readonly serial: string;
  readonly type: DeviceType;
  readonly status: DeviceStatus;
  readonly isAvailable: boolean;
  readonly communicationStatus: CommunicationStatus;
  readonly lastCommunicationAt: string | null;
  readonly lastCommunicationReceivedAt: string | null;
  readonly batteryPercentage: number | null;
  readonly batteryRecordedAt: string | null;
  readonly isBatteryLow: boolean | null;
  readonly firmwareVersion: string | null;
  readonly version: string;
  readonly currentAssignment: DeviceAssignment | null;
}

export interface RegisterDevice {
  readonly serial: string;
  readonly type: DeviceType;
  readonly firmwareVersion?: string;
}

export interface SetDeviceMaintenance {
  readonly inMaintenance: boolean;
  readonly expectedVersion: string;
}

export interface AssignDevice {
  readonly targetId: string;
  readonly expectedVersion: string;
}

export interface ReleaseDevice {
  readonly reason: string;
  readonly expectedVersion: string;
}

/** Inventory filters; an absent value matches every device. */
export interface DeviceFilter {
  readonly type?: DeviceType;
  readonly status?: DeviceStatus;
  readonly communication?: CommunicationStatus;
}

/** The API derives the target from the device type, so the screens offer only the matching targets. */
export function assignmentTargetOf(type: DeviceType): AssignmentTargetType {
  return type === 'SmartCollar' ? 'Cattle' : 'WaterTrough';
}

export function matchesDeviceFilter(device: Device, filter: DeviceFilter): boolean {
  return (filter.type === undefined || device.type === filter.type)
    && (filter.status === undefined || device.status === filter.status)
    && (filter.communication === undefined || device.communicationStatus === filter.communication);
}
