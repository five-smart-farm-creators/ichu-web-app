import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { DefineGeofence, Geofence, GeoPoint, RedefineGeofence } from '../../domain/model/geofence.model';
import { GeofenceRepository } from '../../domain/repositories/geofence.repository';
import { firstMonitoringResponse } from '../http/monitoring-http';

/** Calls the geofence endpoints of a ranch; a lot has at most one geofence, which the API enforces. */
@Injectable()
export class RestGeofenceRepository extends GeofenceRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly Geofence[]> {
    return firstMonitoringResponse(this.http.get<readonly Geofence[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override define(ranchId: string, request: DefineGeofence): Promise<Geofence> {
    const body = {
      lotId: request.lotId,
      name: request.name,
      toleranceMeters: request.toleranceMeters,
      severity: request.severity,
      vertices: coordinates(request.vertices),
    };
    return firstMonitoringResponse(this.http.post<Geofence>(this.collectionUrl(ranchId), body, { timeout: API_REQUEST_TIMEOUT_MS }));
  }

  override redefine(ranchId: string, geofenceId: string, request: RedefineGeofence): Promise<Geofence> {
    const body = {
      name: request.name,
      toleranceMeters: request.toleranceMeters,
      severity: request.severity,
      vertices: coordinates(request.vertices),
    };
    return firstMonitoringResponse(this.http.put<Geofence>(`${this.collectionUrl(ranchId)}/${encodeURIComponent(geofenceId)}`, body, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/geofences`);
  }
}

/** Sends only the two coordinates the API reads, in the order the boundary is drawn. */
function coordinates(vertices: readonly GeoPoint[]): GeoPoint[] {
  return vertices.map(point => ({ latitude: point.latitude, longitude: point.longitude }));
}
