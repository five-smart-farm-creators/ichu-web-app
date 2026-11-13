import { ApiError } from './api-error';

/** Long enough for a sleeping free-tier server to start (about a minute), short enough to surface a real outage. */
export const API_REQUEST_TIMEOUT_MS = 60000;

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
