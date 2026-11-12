import { TestBed } from '@angular/core/testing';
import * as Leaflet from 'leaflet';
import { LeafletLoader } from './leaflet-loader';

// The stub mirrors the production bundle, where the UMD library is exposed only as `default`.
vi.mock('leaflet', () => ({ default: { version: 'stub' } }));

const library = (Leaflet as unknown as { default: unknown }).default;

function stylesheets(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[href="/vendor/leaflet/leaflet.css"]'));
}

describe('LeafletLoader', () => {
  afterEach(() => {
    stylesheets().forEach(link => link.remove());
    TestBed.resetTestingModule();
  });

  it('injects the vendored stylesheet once and resolves the library only after the stylesheet loads', async () => {
    const loader = TestBed.inject(LeafletLoader);
    let resolved = false;

    const first = loader.load().then(module => {
      resolved = true;
      return module;
    });
    const second = loader.load();

    expect(stylesheets()).toHaveLength(1);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resolved).toBe(false);

    stylesheets()[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(library);
    await expect(second).resolves.toBe(library);
  });

  it('rejects when the stylesheet fails and injects a fresh link on retry', async () => {
    const loader = TestBed.inject(LeafletLoader);

    const failed = loader.load();
    stylesheets()[0].dispatchEvent(new Event('error'));

    await expect(failed).rejects.toThrow('leaflet-stylesheet-failed');
    expect(stylesheets()).toHaveLength(0);

    const retry = loader.load();
    expect(stylesheets()).toHaveLength(1);
    stylesheets()[0].dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(library);
  });
});
