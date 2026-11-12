/** One indicator as the API reports it; a reason means no value, so the screen never shows zero instead. */
export interface IndicatorValue {
  readonly value: number | null;
  readonly unit: string;
  readonly formula: string;
  readonly denominator: number | null;
  readonly unavailableReason: string | null;
}

/** The period as the API echoes it, in ISO instants. */
export interface ReportedPeriod {
  readonly from: string;
  readonly to: string;
}

/** Herd indicators of one period; the executive report carries the same shape. */
export interface HerdIndicators {
  readonly ranchId: string;
  readonly period: ReportedPeriod;
  readonly updatedAt: string;
  readonly source: string;
  readonly monitoredAnimals: IndicatorValue;
  readonly openAlertsByType: Readonly<Record<string, number>> | null;
  readonly alertsUnavailableReason: string | null;
  readonly outsideGeofenceAnimals: IndicatorValue;
  readonly mortalityRate: IndicatorValue;
  readonly births: IndicatorValue;
  readonly confirmedPregnancies: IndicatorValue;
  readonly excludedAnimals: number;
  readonly missingReadings: number | null;
  readonly readingsCoverageReason: string | null;
}

/** The indicators a screen lists in order, with the translation key of each name. */
export const INDICATOR_KEYS = [
  'monitoredAnimals',
  'outsideGeofenceAnimals',
  'mortalityRate',
  'births',
  'confirmedPregnancies',
] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];

/** A value counts only when the API sends a finite number and no reason for its absence. */
export function isIndicatorAvailable(indicator: IndicatorValue): boolean {
  return indicator.unavailableReason === null && indicator.value !== null && Number.isFinite(indicator.value);
}

/** Alert types the API counts, in the order a screen lists them; other types follow in arrival order. */
export const ALERT_TYPE_ORDER = ['temperature', 'activity', 'geofence'] as const;

/** Lists the open alert types in a fixed order, so the cards never reorder between refreshes. */
export function orderedAlertTypes(counts: Readonly<Record<string, number>>): readonly string[] {
  const known = ALERT_TYPE_ORDER.filter(type => type in counts);
  const others = Object.keys(counts).filter(type => !(ALERT_TYPE_ORDER as readonly string[]).includes(type));
  return [...known, ...others];
}
