import { HttpParams } from '@angular/common/http';
import { firstValueFrom, type Observable } from 'rxjs';
import { toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';

/** Awaits one response; failures leave as ApiError so presentation can translate them. */
export async function firstAnalyticsResponse<T>(request: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(request);
  } catch (error) {
    throw toApiError(error);
  }
}

/** The API reads the window as half-open ISO instants, so both ends travel as UTC timestamps. */
export function periodParams(period: AnalyticsPeriod): HttpParams {
  return new HttpParams()
    .set('from', period.from.toISOString())
    .set('to', period.to.toISOString());
}
