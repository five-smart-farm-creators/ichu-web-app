import { firstValueFrom, type Observable } from 'rxjs';
import { toApiError } from '../../../../shared/infrastructure/http/api-error';

/** Awaits one response; failures leave as ApiError so presentation can translate them. */
export async function firstSubscriptionPlansResponse<T>(request: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(request);
  } catch (error) {
    throw toApiError(error);
  }
}
