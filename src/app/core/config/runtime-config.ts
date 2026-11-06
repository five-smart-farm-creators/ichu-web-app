import type { FirebaseOptions } from 'firebase/app';

/** Public browser configuration. Server credentials must never be included. */
export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly firebase: FirebaseOptions | null;
}

const defaultConfig: RuntimeConfig = { apiBaseUrl: '/api/v1', firebase: null };

/** Loads deployment configuration without preventing the sign-in page from rendering. */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch(new URL('config.json', document.baseURI), { cache: 'no-store' });
    if (!response.ok) return defaultConfig;
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') return defaultConfig;
    const config = value as Partial<RuntimeConfig>;
    const apiUrl = new URL(config.apiBaseUrl || defaultConfig.apiBaseUrl, document.baseURI);
    if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
      return defaultConfig;
    }
    const firebase = config.firebase;
    return {
      apiBaseUrl: apiUrl.href.replace(/\/$/, ''),
      firebase: firebase?.apiKey && firebase.projectId && firebase.authDomain ? firebase : null,
    };
  } catch {
    return defaultConfig;
  }
}
