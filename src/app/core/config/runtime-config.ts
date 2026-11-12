import { InjectionToken } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';

/** Public browser configuration. Server credentials must never be included. */
export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  readonly firebase: FirebaseOptions | null;
  readonly googleMaps: RuntimeGoogleMapsConfig | null;
}

/** Browser key for the Maps JavaScript API; the key must be restricted to the app's HTTP referrers. */
export interface RuntimeGoogleMapsConfig {
  readonly apiKey: string;
  readonly mapId: string | null;
}

/** Lets adapters read deployment settings without knowing how they were loaded. */
export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

const defaultConfig: RuntimeConfig = { apiBaseUrl: '/api/v1', firebase: null, googleMaps: null };

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
      googleMaps: readGoogleMaps(config.googleMaps),
    };
  } catch {
    return defaultConfig;
  }
}

/** Keeps the map only when a key is present; a blank key or map ID falls back to the table-only screens. */
function readGoogleMaps(value: Partial<RuntimeGoogleMapsConfig> | null | undefined): RuntimeGoogleMapsConfig | null {
  const apiKey = typeof value?.apiKey === 'string' ? value.apiKey.trim() : '';
  if (!apiKey) return null;
  const mapId = typeof value?.mapId === 'string' ? value.mapId.trim() : '';
  return { apiKey, mapId: mapId || null };
}
