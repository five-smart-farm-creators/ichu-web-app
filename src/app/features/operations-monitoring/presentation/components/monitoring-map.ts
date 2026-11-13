import { formatDate } from '@angular/common';
import {
  AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, OnDestroy, output, untracked,
  ViewEncapsulation, viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type * as Leaflet from 'leaflet';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import {
  LeafletLoader, type LeafletModule, OSM_ATTRIBUTION, OSM_TILE_MAX_ZOOM, OSM_TILE_URL,
} from '../../../../shared/infrastructure/maps/leaflet-loader';
import type { GeoPoint } from '../../domain/model/geofence.model';

/** A labelled position; the title is an ear tag or a geofence name, never an identifier. */
export interface MapMarker {
  readonly id: string;
  readonly title: string;
  readonly position: GeoPoint;
  /** When the position was recorded; null when the API did not report it. */
  readonly recordedAt: string | null;
  /** Older than 24 hours, so it is drawn muted and dashed rather than as the current location. */
  readonly stale: boolean;
}

/** A closed boundary that is shown but not edited. */
export interface MapOutline {
  readonly id: string;
  readonly title: string;
  readonly toleranceMeters: number;
  readonly vertices: readonly GeoPoint[];
}

/** The boundary being edited; its saved outline is hidden while it is redrawn, so the two never overlap. */
export interface MapDraft {
  readonly geofenceId: string | null;
  readonly vertices: readonly GeoPoint[];
}

// Leaflet writes SVG attributes, which cannot read CSS variables; OSM tiles stay light, so these copy the light tokens.
const FOREST = '#2E5B43';
const DANGER = '#A93D2C';
const MUTED = '#56635A';

const PERU_CENTER: GeoPoint = { latitude: -9.19, longitude: -75.02 };
const PERU_ZOOM = 5;
const GEOFENCE_ZOOM = 15;
/** Fitting never zooms closer than this, so a lone position still shows its surroundings. */
const FIT_MAX_ZOOM = 17;

const OUTLINE_STYLE: Leaflet.PathOptions = { color: FOREST, weight: 2, fillColor: FOREST, fillOpacity: 0.12 };
const DRAFT_STYLE: Leaflet.PathOptions = { color: DANGER, weight: 2, fillColor: DANGER, fillOpacity: 0.18, interactive: false };
const LIVE_POSITION_STYLE: Leaflet.CircleMarkerOptions = { radius: 7, color: '#ffffff', weight: 2, fillColor: FOREST, fillOpacity: 1 };
const STALE_POSITION_STYLE: Leaflet.CircleMarkerOptions = {
  radius: 7, color: MUTED, weight: 2, dashArray: '3 3', fillColor: '#ffffff', fillOpacity: 0.9,
};

/** The Leaflet objects that exist once the map has been created. */
interface MapView {
  readonly leaflet: LeafletModule;
  readonly map: Leaflet.Map;
  readonly outlineLayer: Leaflet.LayerGroup;
  readonly positionLayer: Leaflet.LayerGroup;
  readonly draftLayer: Leaflet.LayerGroup;
}

/**
 * Shows boundaries and positions on OpenStreetMap. While a draft is given, a map click adds a corner,
 * a dragged corner moves, and a clicked corner is reported so the host can remove it.
 */
@Component({
  selector: 'ichu-monitoring-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Leaflet creates the corner icons outside this template, so their styles cannot be scoped to it.
  encapsulation: ViewEncapsulation.None,
  template: `<div class="ichu-map-frame" [style.height]="height()">
      <div #canvas class="ichu-map-canvas" role="region" [attr.aria-label]="accessibleLabel()"></div>
    </div>`,
  styles: `
    .ichu-map-frame{position:relative;width:100%;overflow:hidden;border:1px solid var(--border);border-radius:12px;isolation:isolate}
    .ichu-map-canvas{height:100%;width:100%}
    .ichu-map-vertex{box-sizing:border-box;background:var(--danger);border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px color-mix(in srgb, var(--ink) 30%, transparent);cursor:grab}
    .ichu-map-vertex:focus-visible{outline:2px solid var(--forest);outline-offset:2px}
    /* Tiles keep their own palette in every theme (no filter); only the controls and tooltips follow the tokens. */
    .ichu-map-frame .leaflet-container{background:var(--surface-2);filter:none}
    .ichu-map-frame .leaflet-bar a{background-color:var(--surface);border-bottom-color:var(--border);color:var(--ink)}
    .ichu-map-frame .leaflet-bar a:hover,.ichu-map-frame .leaflet-bar a:focus{background-color:var(--surface-2)}
    .ichu-map-frame .leaflet-bar a.leaflet-disabled{background-color:var(--surface-2);color:var(--muted)}
    .ichu-map-frame .leaflet-container .leaflet-control-attribution{background:color-mix(in srgb, var(--surface) 80%, transparent);color:var(--ink);text-shadow:none}
    .ichu-map-frame .leaflet-tooltip{background-color:var(--surface);border-color:var(--border);color:var(--ink)}
    .ichu-map-frame .leaflet-tooltip-top:before{border-top-color:var(--surface)}
    .ichu-map-frame .leaflet-tooltip-bottom:before{border-bottom-color:var(--surface)}
    .ichu-map-frame .leaflet-tooltip-left:before{border-left-color:var(--surface)}
    .ichu-map-frame .leaflet-tooltip-right:before{border-right-color:var(--surface)}
  `,
})
export class MonitoringMap implements AfterViewInit, OnDestroy {
  private readonly loader = inject(LeafletLoader);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  readonly outlines = input<readonly MapOutline[]>([]);
  readonly markers = input<readonly MapMarker[]>([]);
  /** The boundary being edited; null in read-only mode. */
  readonly draft = input<MapDraft | null>(null);
  readonly height = input('420px');
  readonly accessibleLabel = input('');
  readonly mapClick = output<GeoPoint>();
  /** The index of a corner the user clicked or activated with Enter. */
  readonly vertexRemove = output<number>();
  private view: MapView | null = null;
  private draftPolygon: Leaflet.Polygon | null = null;
  private draftMarkers: Leaflet.Marker[] = [];
  private fitted: { readonly outlines: readonly MapOutline[]; readonly markers: readonly MapMarker[] } | null = null;
  private focusCornerAfterRender: number | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      const outlines = this.outlines();
      const markers = this.markers();
      const draft = this.draft();
      untracked(() => this.render(outlines, markers, draft));
    });
  }

  ngAfterViewInit(): void {
    // The host renders this component only after the library loads, so a failure here leaves the frame empty.
    this.loader.load().then(leaflet => this.createMap(leaflet), () => undefined);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.view?.map.remove();
    this.view = null;
  }

  /** Corners as they stand on the map, including corners dragged since the draft was last drawn; null outside editing. */
  readDraftVertices(): GeoPoint[] | null {
    if (!this.draftPolygon) return null;
    return this.draftMarkers.map(marker => {
      const point = marker.getLatLng();
      return { latitude: point.lat, longitude: point.lng };
    });
  }

  private createMap(leaflet: LeafletModule): void {
    if (this.destroyed) return;
    const outlines = this.outlines();
    const first = outlines.at(0);
    const map = leaflet.map(this.canvas().nativeElement, {
      center: toLatLng(first ? centroid(first.vertices) : PERU_CENTER),
      zoom: first ? GEOFENCE_ZOOM : PERU_ZOOM,
    });
    leaflet.tileLayer(OSM_TILE_URL, { maxZoom: OSM_TILE_MAX_ZOOM, attribution: OSM_ATTRIBUTION }).addTo(map);
    // A double click zooms the map, so only its first click places a corner.
    map.on('click', event => {
      if (event.originalEvent.detail < 2) this.mapClick.emit({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    this.view = {
      leaflet,
      map,
      outlineLayer: leaflet.layerGroup().addTo(map),
      positionLayer: leaflet.layerGroup().addTo(map),
      draftLayer: leaflet.layerGroup().addTo(map),
    };
    this.render(outlines, this.markers(), this.draft());
    // The container may still be settling its size, for example inside a dialog, so it is measured again once.
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      map.invalidateSize();
      this.fit(this.outlines(), this.markers());
    });
  }

  private render(outlines: readonly MapOutline[], markers: readonly MapMarker[], draft: MapDraft | null): void {
    const view = this.view;
    if (!view) return;
    view.outlineLayer.clearLayers();
    for (const outline of outlines) {
      if (outline.id === draft?.geofenceId) continue;
      view.leaflet.polygon(toLatLngs(outline.vertices), OUTLINE_STYLE)
        .bindTooltip(() => this.translate.instant('monitoring.map.geofenceTooltip', {
          name: outline.title, tolerance: outline.toleranceMeters,
        }), { sticky: true })
        .addTo(view.outlineLayer);
    }
    view.positionLayer.clearLayers();
    for (const marker of markers) {
      view.leaflet.circleMarker(toLatLng(marker.position), marker.stale ? STALE_POSITION_STYLE : LIVE_POSITION_STYLE)
        .bindTooltip(() => this.positionLabel(marker))
        .addTo(view.positionLayer);
    }
    this.renderDraft(view, draft);
    // Only new outlines or positions refit the view; editing a corner never moves it.
    const fitted = this.fitted;
    if (!fitted || fitted.outlines !== outlines || fitted.markers !== markers) {
      this.fit(outlines, markers);
      this.fitted = { outlines, markers };
    }
  }

  private renderDraft(view: MapView, draft: MapDraft | null): void {
    view.draftLayer.clearLayers();
    this.draftPolygon = null;
    this.draftMarkers = [];
    if (draft) {
      this.draftPolygon = view.leaflet.polygon(toLatLngs(draft.vertices), DRAFT_STYLE).addTo(view.draftLayer);
      this.draftMarkers = draft.vertices.map((vertex, index) => this.addCornerMarker(view, vertex, index));
    }
    const focusIndex = this.focusCornerAfterRender;
    this.focusCornerAfterRender = null;
    if (focusIndex !== null && this.draftMarkers.length > 0) {
      // Keeps keyboard users in place after a removal instead of dropping focus to the page.
      this.draftMarkers[Math.min(focusIndex, this.draftMarkers.length - 1)].getElement()?.focus();
    }
  }

  private addCornerMarker(view: MapView, corner: GeoPoint, index: number): Leaflet.Marker {
    const marker = view.leaflet.marker(toLatLng(corner), {
      draggable: true,
      keyboard: true,
      title: this.translate.instant('monitoring.map.vertex', { number: index + 1 }),
      icon: view.leaflet.divIcon({ className: 'ichu-map-vertex', iconSize: [14, 14], iconAnchor: [7, 7] }),
    });
    marker.on('drag', () => this.draftPolygon?.setLatLngs(this.draftMarkers.map(item => item.getLatLng())));
    marker.on('click', () => this.vertexRemove.emit(index));
    marker.addTo(view.draftLayer);
    // Leaflet makes a keyboard-focused marker focusable but does not turn Enter into a click.
    marker.getElement()?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.focusCornerAfterRender = index;
      this.vertexRemove.emit(index);
    });
    return marker;
  }

  private fit(outlines: readonly MapOutline[], markers: readonly MapMarker[]): void {
    const view = this.view;
    if (!view) return;
    const points = [...outlines.flatMap(outline => outline.vertices), ...markers.map(marker => marker.position)];
    if (points.length === 0) return;
    view.map.fitBounds(view.leaflet.latLngBounds(points.map(toLatLng)), { padding: [24, 24], maxZoom: FIT_MAX_ZOOM });
  }

  private positionLabel(marker: MapMarker): string {
    if (!marker.recordedAt) return marker.title;
    const time = formatDate(marker.recordedAt, 'short', formatLocaleTag(this.language.current()));
    return this.translate.instant(marker.stale ? 'monitoring.map.staleAnimalTooltip' : 'monitoring.map.animalTooltip', {
      earTag: marker.title, time,
    });
  }
}

function toLatLng(point: GeoPoint): Leaflet.LatLngTuple {
  return [point.latitude, point.longitude];
}

function toLatLngs(points: readonly GeoPoint[]): Leaflet.LatLngTuple[] {
  return points.map(toLatLng);
}

function centroid(points: readonly GeoPoint[]): GeoPoint {
  const sum = points.reduce((total, point) => ({
    latitude: total.latitude + point.latitude,
    longitude: total.longitude + point.longitude,
  }), { latitude: 0, longitude: 0 });
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}
