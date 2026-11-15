import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  type CattleSummary, CattleInformationContextFacade,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { AssignmentTargetType, DeviceAssignment } from '../../domain/model/device-assignment.model';
import {
  type Device, type DeviceFilter, MANAGED_DEVICE_TYPES, matchesDeviceFilter, RELEASE_REASON_MAX_LENGTH, type RegisterDevice,
} from '../../domain/model/device.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { DeviceRepository } from '../../domain/repositories/device.repository';

/** Coordinates the device inventory of one ranch: filters, registration, maintenance, assignment and target labels. */
@Injectable()
export class DeviceInventoryFacade {
  private readonly deviceRepository = inject(DeviceRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly devices = signal<readonly Device[]>([]);
  readonly cattle = signal<readonly CattleSummary[]>([]);
  readonly filter = signal<DeviceFilter>({});
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly visibleDevices = computed(() => this.devices().filter(device => matchesDeviceFilter(device, this.filter())));
  /** Active animals without a collar; the API keeps one open collar assignment per animal. */
  readonly assignableCattle = computed(() => {
    const collared = this.servedTargetIds('Cattle');
    return this.cattle()
      .filter(animal => animal.status === 'Active' && !collared.has(animal.cattleId))
      .sort((first, second) => first.earTag.localeCompare(second.earTag));
  });
  private readonly earTagByCattleId = computed(() => new Map(this.cattle().map(animal => [animal.cattleId, animal.earTag] as const)));

  /** Shows the ranch's devices with their target labels; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.filter.set({});
    this.devices.set([]);
    this.cattle.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await this.load(ranchId);
  }

  setFilter(filter: DeviceFilter): void {
    this.filter.set(filter);
  }

  /** Names the animal a device serves, or null for other targets and while the animal is not loaded. */
  targetLabel(assignment: DeviceAssignment): string | null {
    if (assignment.targetType !== 'Cattle') return null;
    return this.earTagByCattleId().get(assignment.targetId) ?? null;
  }

  /** Registers a device in the current ranch; the API decides whether the serial is free. */
  async register(request: RegisterDevice): Promise<Device> {
    const ranchId = this.requireRanch();
    const created = await this.deviceRepository.register(ranchId, request);
    this.devices.update(devices => [...devices, created].sort((first, second) => first.serial.localeCompare(second.serial)));
    return created;
  }

  setMaintenance(deviceId: string, inMaintenance: boolean): Promise<void> {
    return this.changeDevice(deviceId, (ranchId, device) =>
      this.deviceRepository.setMaintenance(ranchId, device.id, { inMaintenance, expectedVersion: device.version }));
  }

  assign(deviceId: string, targetId: string): Promise<void> {
    return this.changeDevice(deviceId, (ranchId, device) =>
      this.deviceRepository.assign(ranchId, device.id, { targetId, expectedVersion: device.version }));
  }

  /** The API closes the assignment only with a reason, so a blank one is refused before any request. */
  async release(deviceId: string, reason: string): Promise<void> {
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > RELEASE_REASON_MAX_LENGTH) throw new ApiError(400, 'IoTAssets.InvalidInput', null);
    return this.changeDevice(deviceId, (ranchId, device) =>
      this.deviceRepository.release(ranchId, device.id, { reason: trimmed, expectedVersion: device.version }));
  }

  async assignmentsOf(deviceId: string): Promise<readonly DeviceAssignment[]> {
    return this.deviceRepository.assignments(this.requireRanch(), deviceId);
  }

  private servedTargetIds(targetType: AssignmentTargetType): ReadonlySet<string> {
    return new Set(this.devices().flatMap(device => {
      const assignment = device.currentAssignment;
      return assignment && assignment.targetType === targetType ? [assignment.targetId] : [];
    }));
  }

  private requireRanch(): string {
    if (!this.ranchId) throw new ApiError(0, 'unknown', null);
    return this.ranchId;
  }

  /** A version conflict reloads the inventory before the error reaches the dialog that asked for the change. */
  private async changeDevice(deviceId: string, send: (ranchId: string, device: Device) => Promise<Device>): Promise<void> {
    const ranchId = this.requireRanch();
    const device = this.devices().find(item => item.id === deviceId);
    if (!device) throw new ApiError(0, 'unknown', null);
    try {
      const updated = await send(ranchId, device);
      this.devices.update(devices => devices.map(item => (item.id === updated.id ? updated : item)));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) await this.load(ranchId);
      throw apiError;
    }
  }

  private async load(ranchId: string): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [devices, cattle] = await Promise.all([
        this.deviceRepository.list(ranchId),
        this.cattleContext.cattleSummaries(ranchId),
      ]);
      if (request !== this.requestId) return;
      this.devices.set(devices
        .filter(device => MANAGED_DEVICE_TYPES.includes(device.type))
        .sort((first, second) => first.serial.localeCompare(second.serial)));
      this.cattle.set(cattle);
    } catch (error) {
      if (request !== this.requestId) return;
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
