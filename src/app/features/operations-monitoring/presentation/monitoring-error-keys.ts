import type { ContextErrorKeys } from '../../../shared/presentation/api-error-message.pipe';
import { VERSION_CONFLICT } from '../domain/model/version-conflict';

/** Monitoring failures with their own wording; generic HTTP failures are translated by the shared API error pipe. */
export const MONITORING_ERROR_KEYS: ContextErrorKeys = new Map([
  [VERSION_CONFLICT, 'monitoring.errors.versionConflict'],
  // The same sentence the dialog shows before saving, so a level clash reads alike on both paths.
  ['OperationsMonitoring.ThresholdLevelsInconsistent', 'monitoring.validation.thresholdLevels'],
]);
