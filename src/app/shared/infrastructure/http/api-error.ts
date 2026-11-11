import { HttpErrorResponse } from '@angular/common/http';

/** A failed backend call; `code` is a stable key that presentation maps to a localized message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string | null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Reads the ProblemDetails code and localized title; a status 0 response is treated as unreachable. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return new ApiError(0, 'network', null);
    const problem = problemDetails(error.error);
    return new ApiError(error.status, problem.code ?? `http-${error.status}`, problem.title);
  }
  return new ApiError(0, 'unknown', null);
}

function problemDetails(body: unknown): { readonly code: string | null; readonly title: string | null } {
  const problem = (body ?? {}) as { code?: unknown; title?: unknown };
  const code = typeof problem.code === 'string' && problem.code.trim() ? problem.code.trim() : null;
  const title = typeof problem.title === 'string' && problem.title.trim() ? problem.title.trim() : null;
  return { code, title };
}
