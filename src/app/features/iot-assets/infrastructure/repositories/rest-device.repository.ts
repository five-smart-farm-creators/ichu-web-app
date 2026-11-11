import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { DeviceAssignment } from '../../domain/model/device-assignment.model';
import type {
  AssignDevice, Device, RegisterDevice, ReleaseDevice, SetDeviceMaintenance,
} from '../../domain/model/device.model';
import { DeviceRepository } from '../../domain/repositories/device.repository';
import { firstIotAssetsResponse } from '../http/iot-assets-http';

/** Calls the device endpoints of the ICHU API; every URL is scoped to the ranch. */
@Injectable()
export class RestDeviceRepository extends DeviceRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly Device[]> {
    return firstIotAssetsResponse(this.http.get<readonly Device[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override register(ranchId: string, request: RegisterDevice): Promise<Device> {
    return firstIotAssetsResponse(this.http.post<Device>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override setMaintenance(ranchId: string, deviceId: string, request: SetDeviceMaintenance): Promise<Device> {
    return firstIotAssetsResponse(this.http.put<Device>(this.itemUrl(ranchId, deviceId, '/maintenance'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override assign(ranchId: string, deviceId: string, request: AssignDevice): Promise<Device> {
    return firstIotAssetsResponse(this.http.post<Device>(this.itemUrl(ranchId, deviceId, '/assignments'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override release(ranchId: string, deviceId: string, request: ReleaseDevice): Promise<Device> {
    return firstIotAssetsResponse(this.http.post<Device>(this.itemUrl(ranchId, deviceId, '/releases'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override assignments(ranchId: string, deviceId: string): Promise<readonly DeviceAssignment[]> {
    return firstIotAssetsResponse(this.http.get<readonly DeviceAssignment[]>(this.itemUrl(ranchId, deviceId, '/assignments'), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/devices`);
  }

  private itemUrl(ranchId: string, deviceId: string, suffix: string): string {
    return `${this.collectionUrl(ranchId)}/${encodeURIComponent(deviceId)}${suffix}`;
  }
}
