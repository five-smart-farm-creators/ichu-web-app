import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import type * as Leaflet from 'leaflet';

/** Copied from node_modules/leaflet/dist by angular.json, so the stylesheet is served by this app. */
const LEAFLET_STYLESHEET_URL = '/vendor/leaflet/leaflet.css';

/** OpenStreetMap tiles need no key; the tile usage policy requires the attribution to stay visible. */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_TILE_MAX_ZOOM = 19;
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export type LeafletModule = typeof Leaflet;

/** Loads Leaflet on first use, so the library and its stylesheet stay out of the initial bundle. */
@Injectable({ providedIn: 'root' })
export class LeafletLoader {
  private readonly document = inject(DOCUMENT);
  private stylesheet: Promise<void> | null = null;
  private leaflet: Promise<LeafletModule> | null = null;

  /** Resolves once the stylesheet and the library are both ready; a failed attempt is cleared so it can be retried. */
  load(): Promise<LeafletModule> {
    this.leaflet ??= Promise.all([this.loadStylesheet(), import('leaflet')])
      .then(([, module]) => module)
      .catch((error: unknown) => {
        this.leaflet = null;
        throw error;
      });
    return this.leaflet;
  }

  /** The stylesheet is awaited so the map is never drawn unstyled. */
  private loadStylesheet(): Promise<void> {
    this.stylesheet ??= new Promise<void>((resolve, reject) => {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_STYLESHEET_URL;
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove();
        this.stylesheet = null;
        reject(new Error('leaflet-stylesheet-failed'));
      };
      this.document.head.append(link);
    });
    return this.stylesheet;
  }
}
