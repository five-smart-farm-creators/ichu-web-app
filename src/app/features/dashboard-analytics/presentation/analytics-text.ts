/**
 * The API writes reasons and formulas in English and does not localize them, so the known texts map to
 * translation keys; any other text passes through unchanged.
 */
const TEXT_KEYS = new Map<string, string>([
  ['The population snapshot is incomplete.', 'analytics.texts.populationIncomplete'],
  ['The alert snapshot is incomplete.', 'analytics.texts.alertsIncomplete'],
  ['Geofence observations are incomplete.', 'analytics.texts.geofenceIncomplete'],
  ['There are no animals at risk.', 'analytics.texts.noAnimalsAtRisk'],
  ['Birth observations are unavailable.', 'analytics.texts.birthsUnavailable'],
  ['Pregnancy observations are unavailable.', 'analytics.texts.pregnanciesUnavailable'],
  ['The expected reading count is unavailable.', 'analytics.texts.expectedReadingsUnavailable'],
  ['distinct animals with valid period readings', 'analytics.texts.formulaMonitored'],
  ['animals outside their assigned geofence at the period end', 'analytics.texts.formulaGeofence'],
  ['100 * deaths during period / animals at risk during period', 'analytics.texts.formulaMortality'],
  ['recorded births during the period', 'analytics.texts.formulaBirths'],
  ['confirmed pregnancies during the period', 'analytics.texts.formulaPregnancies'],
  ['There are no valid readings for this lot and metric.', 'analytics.texts.noLotReadings'],
  ['Expected readings are unavailable for part of the lot.', 'analytics.texts.lotExpectedUnavailable'],
  ['At least five animals with valid telemetry are required.', 'analytics.texts.fiveAnimalsRequired'],
  ['The animal has no valid readings in this lot.', 'analytics.texts.animalNoReadings'],
  ['Case observations are incomplete.', 'analytics.texts.casesIncomplete'],
  ['The condition has no configured incubation period.', 'analytics.texts.noIncubationPeriod'],
  ['At least two recorded cases are required to build a progression.', 'analytics.texts.twoCasesRequired'],
  ['The observation period is shorter than the incubation period.', 'analytics.texts.periodShorter'],
]);

/** Returns the translation key of a known API text, or the text itself, which the translate pipe then shows as is. */
export function analyticsTextKey(text: string): string {
  return TEXT_KEYS.get(text) ?? text;
}
