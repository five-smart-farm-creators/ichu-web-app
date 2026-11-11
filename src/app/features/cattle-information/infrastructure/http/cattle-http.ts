import { firstValueFrom, type Observable } from 'rxjs';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { VERSION_CONFLICT } from '../../domain/model/cattle.model';

/** The backend reports stale animals and lots with different codes; both mean the caller must reload. */
const VERSION_MISMATCH_CODES: ReadonlySet<string> = new Set([
  'CattleInformation.CattleVersionMismatch',
  'CattleInformation.LotVersionMismatch',
]);

/** Awaits one response; failures leave as ApiError with the version mismatch folded into one code. */
export async function firstCattleResponse<T>(request: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(request);
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 409 && VERSION_MISMATCH_CODES.has(apiError.code)) {
      throw new ApiError(409, VERSION_CONFLICT, null);
    }
    throw apiError;
  }
}
