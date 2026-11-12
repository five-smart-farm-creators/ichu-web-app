import {
  GEOFENCE_NAME_MAX_LENGTH, GEOFENCE_TOLERANCE_MAX_METERS, isValidGeofenceName, isValidGeofenceTolerance, isValidGeofenceVertexCount,
} from './geofence.model';

describe('geofence rules', () => {
  it('accepts a trimmed name of up to 80 characters', () => {
    expect(isValidGeofenceName('   ')).toBe(false);
    expect(isValidGeofenceName('  North paddock  ')).toBe(true);
    expect(isValidGeofenceName('x'.repeat(GEOFENCE_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidGeofenceName('x'.repeat(GEOFENCE_NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it('accepts whole-meter tolerances from 1 to the API maximum', () => {
    expect(isValidGeofenceTolerance(0)).toBe(false);
    expect(isValidGeofenceTolerance(1)).toBe(true);
    expect(isValidGeofenceTolerance(GEOFENCE_TOLERANCE_MAX_METERS)).toBe(true);
    expect(isValidGeofenceTolerance(GEOFENCE_TOLERANCE_MAX_METERS + 1)).toBe(false);
    expect(isValidGeofenceTolerance(12.5)).toBe(false);
  });

  it('needs at least three corners to enclose an area', () => {
    expect(isValidGeofenceVertexCount(2)).toBe(false);
    expect(isValidGeofenceVertexCount(3)).toBe(true);
    expect(isValidGeofenceVertexCount(501)).toBe(false);
  });
});
