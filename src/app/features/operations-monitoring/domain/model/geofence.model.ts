import type { AlertSeverity } from './alert.model';

export const GEOFENCE_NAME_MAX_LENGTH = 80;

/** The API accepts a tolerance from one meter up to the largest 16-bit value. */
export const GEOFENCE_TOLERANCE_MAX_METERS = 32767;

export const GEOFENCE_MIN_VERTICES = 3;
export const GEOFENCE_MAX_VERTICES = 500;

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** The permitted grazing area of one lot; `revision` changes whenever its boundary or settings change. */
export interface Geofence {
  readonly geofenceId: string;
  readonly lotId: string;
  readonly name: string;
  readonly toleranceMeters: number;
  readonly severity: AlertSeverity;
  readonly revision: number;
  readonly vertices: readonly GeoPoint[];
}

export interface DefineGeofence {
  readonly lotId: string;
  readonly name: string;
  readonly toleranceMeters: number;
  readonly severity: AlertSeverity;
  readonly vertices: readonly GeoPoint[];
}

export type RedefineGeofence = Omit<DefineGeofence, 'lotId'>;

export function isValidGeofenceName(name: string): boolean {
  const length = name.trim().length;
  return length > 0 && length <= GEOFENCE_NAME_MAX_LENGTH;
}

export function isValidGeofenceTolerance(meters: number): boolean {
  return Number.isInteger(meters) && meters >= 1 && meters <= GEOFENCE_TOLERANCE_MAX_METERS;
}

export function isValidGeofenceVertexCount(count: number): boolean {
  return count >= GEOFENCE_MIN_VERTICES && count <= GEOFENCE_MAX_VERTICES;
}
