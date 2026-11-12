import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { LanguageService } from '../i18n/language.service';

const MAPS_SCRIPT_URL = 'https://maps.googleapis.com/maps/api/js';

/** A stalled download must not leave a map area waiting forever. */
export const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 15000;

/** Advanced markers need a map ID, so the demo ID stands in when none is configured. */
const DEMO_MAP_ID = 'DEMO_MAP_ID';

const MAPS_READY_CALLBACK = 'ichuGoogleMapsReady';

/** The part of the Maps global that loading uses once the script has run. */
interface MapsGlobal {
  importLibrary(name: 'maps' | 'marker'): Promise<unknown>;
}

/** Loads the Maps JavaScript API once per page, using the key from the runtime configuration. */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoader {
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);
  private loading: Promise<void> | null = null;

  get mapId(): string {
    return this.config.googleMaps?.mapId ?? DEMO_MAP_ID;
  }

  /** Resolves when the map and marker libraries are ready; a failed attempt is cleared so it can be retried. */
  load(): Promise<void> {
    this.loading ??= this.injectScript().catch(error => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  private injectScript(): Promise<void> {
    const googleMaps = this.config.googleMaps;
    if (!googleMaps) return Promise.reject(new Error('google-maps-not-configured'));
    const callbackHost = this.document.defaultView as unknown as Record<string, unknown>;
    const query = `key=${encodeURIComponent(googleMaps.apiKey)}&v=weekly&loading=async`
      + `&libraries=marker,geometry&language=${this.language.current()}&callback=${MAPS_READY_CALLBACK}`;
    return new Promise<void>((resolve, reject) => {
      const script = this.document.createElement('script');
      const fail = (error: Error): void => {
        clearTimeout(timer);
        delete callbackHost[MAPS_READY_CALLBACK];
        script.remove();
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('google-maps-timeout')), GOOGLE_MAPS_LOAD_TIMEOUT_MS);
      // The script's load event can fire before the API finishes booting; Google calls this callback once it has.
      callbackHost[MAPS_READY_CALLBACK] = () => {
        importReadyLibraries().then(() => {
          clearTimeout(timer);
          delete callbackHost[MAPS_READY_CALLBACK];
          resolve();
        }, fail);
      };
      script.async = true;
      script.src = `${MAPS_SCRIPT_URL}?${query}`;
      script.onerror = () => fail(new Error('google-maps-script-failed'));
      this.document.head.append(script);
    });
  }
}

async function importReadyLibraries(): Promise<void> {
  const maps = (window as unknown as { google?: { maps?: MapsGlobal } }).google?.maps;
  if (!maps) throw new Error('google-maps-missing');
  await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
}
