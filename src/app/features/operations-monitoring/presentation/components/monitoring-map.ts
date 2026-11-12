import { ChangeDetectionStrategy, Component, computed, inject, input, output, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker, MapPolygon } from '@angular/google-maps';
import { GoogleMapsLoader } from '../../../../shared/infrastructure/maps/google-maps-loader';
import type { GeoPoint } from '../../domain/model/geofence.model';

/** A labelled point; the title is an ear tag or a geofence name, never an identifier. */
export interface MapMarker {
  readonly id: string;
  readonly title: string;
  readonly position: GeoPoint;
}

/** A closed boundary that is shown but not edited. */
export interface MapOutline {
  readonly id: string;
  readonly vertices: readonly GeoPoint[];
}

// Google Maps takes literal colors, so these copy the forest and danger tokens.
const FOREST = '#33513e';
const DANGER = '#a4463c';

/** Shows boundaries and points on Google Maps; the boundary being drawn is editable and is read back from the map on demand. */
@Component({
  selector: 'ichu-monitoring-map',
  imports: [GoogleMap, MapAdvancedMarker, MapPolygon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="map-frame" role="region" [attr.aria-label]="accessibleLabel()" [style.height]="height()">
      <google-map [height]="'100%'" [width]="'100%'" [center]="centerLiteral()" [zoom]="zoom()" [mapId]="mapId"
        [options]="mapOptions" (mapClick)="clickPoint($event)">
        @for (outline of outlinePaths(); track outline.id) {
          <map-polygon [paths]="outline.path" [options]="outlineOptions" />
        }
        @if (draftPath(); as path) {
          <map-polygon #draftPolygon [paths]="path" [options]="draftOptions" />
        }
        @for (marker of markerViews(); track marker.id) {
          <map-advanced-marker [position]="marker.position" [title]="marker.title" />
        }
      </google-map>
    </div>`,
  styles: '.map-frame{position:relative;width:100%;overflow:hidden;border:1px solid var(--border);border-radius:12px}',
})
export class MonitoringMap {
  private readonly draftPolygon = viewChild<MapPolygon>('draftPolygon');
  readonly mapId = inject(GoogleMapsLoader).mapId;
  readonly outlines = input<readonly MapOutline[]>([]);
  readonly markers = input<readonly MapMarker[]>([]);
  /** The corners of the boundary being drawn; null when no boundary is being edited. */
  readonly draft = input<readonly GeoPoint[] | null>(null);
  readonly center = input<GeoPoint>({ latitude: 0, longitude: 0 });
  readonly zoom = input(2);
  readonly height = input('420px');
  readonly accessibleLabel = input('');
  readonly mapClick = output<GeoPoint>();
  readonly centerLiteral = computed(() => toLiteral(this.center()));
  readonly outlinePaths = computed(() => this.outlines().map(outline => ({
    id: outline.id,
    path: outline.vertices.map(toLiteral),
  })));
  readonly draftPath = computed(() => this.draft()?.map(toLiteral) ?? null);
  readonly markerViews = computed(() => this.markers().map(marker => ({
    id: marker.id,
    title: marker.title,
    position: toLiteral(marker.position),
  })));
  readonly mapOptions: google.maps.MapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true };
  readonly outlineOptions: google.maps.PolygonOptions = {
    strokeColor: FOREST, fillColor: FOREST, fillOpacity: 0.12, strokeWeight: 2, clickable: false, editable: false,
  };
  readonly draftOptions: google.maps.PolygonOptions = {
    strokeColor: DANGER, fillColor: DANGER, fillOpacity: 0.18, strokeWeight: 2, clickable: false, editable: true,
  };

  /** Corners as they stand on the map, including corners the user has dragged since they were last set. */
  readDraftVertices(): GeoPoint[] | null {
    const polygon = this.draftPolygon()?.polygon;
    if (!polygon) return null;
    return polygon.getPath().getArray().map(point => ({ latitude: point.lat(), longitude: point.lng() }));
  }

  clickPoint(event: google.maps.MapMouseEvent | google.maps.IconMouseEvent): void {
    const point = event.latLng;
    if (point) this.mapClick.emit({ latitude: point.lat(), longitude: point.lng() });
  }
}

function toLiteral(point: GeoPoint): google.maps.LatLngLiteral {
  return { lat: point.latitude, lng: point.longitude };
}
