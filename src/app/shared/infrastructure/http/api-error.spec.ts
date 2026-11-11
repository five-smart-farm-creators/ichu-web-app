import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

describe('toApiError', () => {
  it('keeps the ProblemDetails code and localized title', () => {
    const error = toApiError(new HttpErrorResponse({
      status: 409,
      error: { code: 'account-exists', title: 'An account already exists.' },
    }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'account-exists', title: 'An account already exists.' });
  });

  it('reports an unreachable backend as a network failure', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0, error: null }))).toMatchObject({
      status: 0, code: 'network', title: null,
    });
  });

  it('reports a timed-out request as a network failure', () => {
    const timeout = new HttpErrorResponse({
      status: 0,
      statusText: 'Request timeout',
      error: new DOMException('Request timed out', 'TimeoutError'),
    });

    expect(toApiError(timeout)).toMatchObject({ code: 'network' });
  });

  it('falls back to the HTTP status when the body has no code', () => {
    expect(toApiError(new HttpErrorResponse({ status: 500, error: { title: 'Server error' } }))).toMatchObject({
      status: 500, code: 'http-500', title: 'Server error',
    });
    expect(toApiError(new HttpErrorResponse({ status: 503, error: null }))).toMatchObject({
      code: 'http-503', title: null,
    });
  });

  it('treats errors that are not HTTP responses as unknown', () => {
    expect(toApiError(new TypeError('unexpected'))).toMatchObject({ code: 'unknown' });
  });

  it('returns an existing ApiError unchanged', () => {
    const original = new ApiError(0, 'configuration', null);

    expect(toApiError(original)).toBe(original);
  });
});
