import type { ContextErrorKeys } from '../../../shared/presentation/api-error-message.pipe';
import { VERSION_CONFLICT } from '../domain/model/version-conflict';

/** IoT asset failures with their own wording; generic HTTP failures are translated by the shared API error pipe. */
export const IOT_ERROR_KEYS: ContextErrorKeys = new Map([[VERSION_CONFLICT, 'devices.errors.versionConflict']]);
