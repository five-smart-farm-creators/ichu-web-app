import type { ContextErrorKeys } from '../../../shared/presentation/api-error-message.pipe';
import { VERSION_CONFLICT } from '../domain/model/cattle.model';

/** Cattle failures with their own wording; generic HTTP failures are translated by the shared API error pipe. */
export const CATTLE_ERROR_KEYS: ContextErrorKeys = new Map([[VERSION_CONFLICT, 'cattle.errors.versionConflict']]);
