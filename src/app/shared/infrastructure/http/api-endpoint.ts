import { ApiError } from './api-error';

/** Stops a stalled request so the screen can offer a retry instead of waiting indefinitely. */
export const API_REQUEST_TIMEOUT_MS = 15000;

const API_VERSION_PATH = '/api/v1';

/** Builds an endpoint under the versioned API root; the base may already include the version. */
export function apiEndpoint(baseUrl: string, path: string): string {
  const root = apiRoot(baseUrl);
  if (!root) throw new ApiError(0, 'configuration', null);
  return root + '/' + path.replace(/^\/+/, '');
}

/** Lets interceptors recognize ICHU API calls without matching static assets. */
export function isApiRequestUrl(url: string, baseUrl: string): boolean {
  const root = apiRoot(baseUrl);
  return root !== '' && url.startsWith(root + '/');
}

function apiRoot(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return '';
  return base.endsWith(API_VERSION_PATH) ? base : base + API_VERSION_PATH;
}
