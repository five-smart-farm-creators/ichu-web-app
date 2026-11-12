import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG, type RuntimeGoogleMapsConfig } from '../../../core/config/runtime-config';
import { LanguageService } from '../i18n/language.service';
import { GOOGLE_MAPS_LOAD_TIMEOUT_MS, GoogleMapsLoader } from './google-maps-loader';

interface MapsWindow {
  google?: { maps: { importLibrary: (name: string) => Promise<unknown> } };
}

function mapsScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[src^="https://maps.googleapis.com/"]'));
}

/** Builds the loader against a runtime configuration; the Maps script is never downloaded because events are dispatched by hand. */
function configure(googleMaps: RuntimeGoogleMapsConfig | null): GoogleMapsLoader {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null, googleMaps } },
      { provide: LanguageService, useValue: { current: signal('en') } },
    ],
  });
  return TestBed.inject(GoogleMapsLoader);
}

describe('GoogleMapsLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    mapsScripts().forEach(script => script.remove());
    delete (window as unknown as MapsWindow).google;
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('rejects without injecting a script when no key is configured', async () => {
    const loader = configure(null);

    await expect(loader.load()).rejects.toThrow('google-maps-not-configured');
    expect(mapsScripts()).toHaveLength(0);
  });

  it('injects one script with the key, language and libraries, and shares it between callers', () => {
    const loader = configure({ apiKey: 'test-key', mapId: null });

    void loader.load();
    void loader.load();

    const scripts = mapsScripts();
    expect(scripts).toHaveLength(1);
    const url = new URL(scripts[0].src);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(url.searchParams.get('key')).toBe('test-key');
    expect(url.searchParams.get('libraries')).toBe('marker,geometry');
    expect(url.searchParams.get('language')).toBe('en');
    expect(url.searchParams.get('loading')).toBe('async');
  });

  it('resolves once Google calls back and the map and marker libraries are ready', async () => {
    const importLibrary = vi.fn(async () => ({}));
    (window as unknown as MapsWindow).google = { maps: { importLibrary } };
    const loader = configure({ apiKey: 'test-key', mapId: null });

    const ready = loader.load();
    // The load event alone must not resolve: the API may still be booting.
    mapsScripts()[0].dispatchEvent(new Event('load'));
    expect(importLibrary).not.toHaveBeenCalled();
    expect(mapsScripts()[0].src).toContain('callback=ichuGoogleMapsReady');
    (window as unknown as Record<string, () => void>)['ichuGoogleMapsReady']();

    await expect(ready).resolves.toBeUndefined();
    expect(importLibrary).toHaveBeenCalledWith('maps');
    expect(importLibrary).toHaveBeenCalledWith('marker');
  });

  it('removes a failed script so that a retry injects a fresh one', async () => {
    const loader = configure({ apiKey: 'test-key', mapId: null });

    const failed = loader.load();
    mapsScripts()[0].dispatchEvent(new Event('error'));

    await expect(failed).rejects.toThrow('google-maps-script-failed');
    expect(mapsScripts()).toHaveLength(0);
    void loader.load();
    expect(mapsScripts()).toHaveLength(1);
  });

  it('rejects when the script does not become ready within the timeout', async () => {
    const loader = configure({ apiKey: 'test-key', mapId: null });

    const ready = loader.load();
    const assertion = expect(ready).rejects.toThrow('google-maps-timeout');
    vi.advanceTimersByTime(GOOGLE_MAPS_LOAD_TIMEOUT_MS);

    await assertion;
  });

  it('uses the demo map ID until a map ID is configured', () => {
    expect(configure({ apiKey: 'test-key', mapId: null }).mapId).toBe('DEMO_MAP_ID');
    expect(configure({ apiKey: 'test-key', mapId: 'map-123' }).mapId).toBe('map-123');
  });
});
