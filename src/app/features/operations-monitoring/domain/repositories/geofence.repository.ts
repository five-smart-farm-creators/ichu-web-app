import type { DefineGeofence, Geofence, RedefineGeofence } from '../model/geofence.model';

/** Defines, redefines and lists the geofences of one ranch. */
export abstract class GeofenceRepository {
  abstract list(ranchId: string): Promise<readonly Geofence[]>;
  abstract define(ranchId: string, request: DefineGeofence): Promise<Geofence>;
  abstract redefine(ranchId: string, geofenceId: string, request: RedefineGeofence): Promise<Geofence>;
}
