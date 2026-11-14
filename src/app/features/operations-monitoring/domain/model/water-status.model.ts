/** Controller state; NoCommunication means more than six hours since the last receipt at the backend. */
export type WaterControllerStatus = 'NoController' | 'NoReadings' | 'Communicating' | 'NoCommunication';

/** Whether the latest reading gives a usable temperature; Unavailable means there is no reading at all. */
export type WaterMeasurementStatus = 'Unavailable' | 'Invalid' | 'Valid';

/** The latest temperature against the trough band; Unavailable means there is no valid temperature to compare. */
export type WaterRangeStatus = 'NotConfigured' | 'Unavailable' | 'BelowRange' | 'WithinRange' | 'AboveRange';

export type WaterHeaterState = 'Off' | 'On';

/** A temperature in Celsius captured by a water controller; the temperature means nothing when `isValid` is false. */
export interface WaterReading {
  readonly id: string;
  readonly readingId: string;
  readonly controllerId: string;
  readonly waterTroughId: string;
  readonly ranchId: string;
  readonly gatewayId: string;
  readonly temperature: number;
  readonly temperatureUnit: 'Celsius';
  readonly isValid: boolean;
  readonly heaterState: WaterHeaterState;
  readonly capturedAt: string;
  readonly receivedAt: string;
  readonly origin: string;
}

/** The controller and temperature state of one water trough, with its latest reading when there is one. */
export interface WaterTroughStatus {
  readonly waterTroughId: string;
  readonly name: string;
  readonly lotId: string | null;
  readonly minimumCelsius: number | null;
  readonly maximumCelsius: number | null;
  readonly controllerStatus: WaterControllerStatus;
  readonly controllerId: string | null;
  readonly controllerAssignedAt: string | null;
  readonly lastCommunicationAt: string | null;
  readonly measurementStatus: WaterMeasurementStatus;
  readonly rangeStatus: WaterRangeStatus;
  readonly latestReading: WaterReading | null;
  readonly evaluatedAt: string;
}

/** A half-open time range: the start is included and the end is excluded. */
export interface WaterReadingPeriod {
  readonly from: Date;
  readonly to: Date;
}

/** One page of a controller's readings, oldest capture first. */
export interface WaterReadingsPage {
  readonly controllerId: string;
  readonly from: string;
  readonly to: string;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly items: readonly WaterReading[];
}

/** A temperature exists only for a valid reading; an invalid reading is never zero. */
export function waterTemperature(reading: WaterReading): number | null {
  return reading.isValid ? reading.temperature : null;
}
