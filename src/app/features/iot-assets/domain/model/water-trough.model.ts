/** Temperature limits the screens accept; the API stores a wider band, so the screens are stricter. */
export const TEMPERATURE_MINIMUM_LIMIT_CELSIUS = -10;
export const TEMPERATURE_MAXIMUM_LIMIT_CELSIUS = 60;
export const WATER_TROUGH_NAME_MAX_LENGTH = 80;

export interface TemperatureRange {
  readonly minimumCelsius: number;
  readonly maximumCelsius: number;
}

/** A drinking place of the ranch; `version` changes whenever its temperature band changes. */
export interface WaterTrough {
  readonly id: string;
  readonly ranchId: string;
  readonly name: string;
  readonly lotId: string | null;
  readonly temperatureRange: TemperatureRange | null;
  readonly version: string;
}

export interface RegisterWaterTrough {
  readonly name: string;
  readonly lotId?: string;
}

export interface ConfigureTemperatureRange extends TemperatureRange {
  readonly expectedVersion: string;
}

/** The band must be ordered, inside the screen limits and written with at most one decimal, as the API stores it. */
export function isValidTemperatureRange(range: TemperatureRange): boolean {
  const { minimumCelsius, maximumCelsius } = range;
  return minimumCelsius < maximumCelsius
    && isTenthOfDegreeInLimits(minimumCelsius)
    && isTenthOfDegreeInLimits(maximumCelsius);
}

function isTenthOfDegreeInLimits(value: number): boolean {
  if (!Number.isFinite(value) || value < TEMPERATURE_MINIMUM_LIMIT_CELSIUS || value > TEMPERATURE_MAXIMUM_LIMIT_CELSIUS) {
    return false;
  }
  // Binary floats make 12.3 * 10 slightly inexact, so compare with a tolerance rather than exactly.
  const tenths = value * 10;
  return Math.abs(tenths - Math.round(tenths)) < 1e-9;
}
