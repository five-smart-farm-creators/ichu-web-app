import { firstValueFrom, type Observable } from 'rxjs';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';

/** The backend reports every stale device, trough and gateway with this code; the same code also covers other data conflicts. */
const VERSION_MISMATCH_CODE = 'IoTAssets.Conflict';

/** Awaits one response; a stale version leaves as the shared version-conflict code so the screen reloads the record. */
export async function firstIotAssetsResponse<T>(request: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(request);
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 409 && apiError.code === VERSION_MISMATCH_CODE) {
      throw new ApiError(409, VERSION_CONFLICT, null);
    }
    throw apiError;
  }
}
