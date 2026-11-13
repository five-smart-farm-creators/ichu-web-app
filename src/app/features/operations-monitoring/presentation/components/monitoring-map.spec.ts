import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import * as Leaflet from 'leaflet';
import { of } from 'rxjs';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { LeafletLoader } from '../../../../shared/infrastructure/maps/leaflet-loader';
import type { GeoPoint } from '../../domain/model/geofence.model';
import { type MapDraft, type MapMarker, type MapOutline, MonitoringMap } from './monitoring-map';

// Tiles are never requested in tests: the OpenStreetMap layer is replaced by an empty layer.
vi.mock('leaflet', async importOriginal => {
  const actual = await importOriginal<typeof import('leaflet')>();
  return { ...actual, tileLayer: () => actual.layerGroup() };
});

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

const square = [
  { latitude: -12.1, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.0 },
];

@Component({
  imports: [MonitoringMap],
  template: `<ichu-monitoring-map accessibleLabel="Test grazing map" [outlines]="outlines()" [markers]="markers()"
    [draft]="draft()" (mapClick)="clicks.push($event)" (vertexRemove)="removeCorner($event)" />`,
})
class HostComponent {
  // Signals, because a zoneless test host is only refreshed when a signal it reads changes.
  readonly outlines = signal<MapOutline[]>([{ id: 'geofence-1', title: 'North paddock', toleranceMeters: 15, vertices: square }]);
  readonly markers = signal<MapMarker[]>([{
    id: 'cattle-1', title: '101', position: { latitude: -12.15, longitude: -77.05 }, recordedAt: '2026-11-11T11:55:00Z', stale: false,
  }]);
  readonly draft = signal<MapDraft | null>(null);
  readonly clicks: GeoPoint[] = [];
  readonly removed: number[] = [];

  /** Mirrors the host page: the removed corner leaves the draft, and the map redraws the rest. */
  removeCorner(index: number): void {
    this.removed.push(index);
    this.draft.update(draft => (draft ? { ...draft, vertices: draft.vertices.filter((_, position) => position !== index) } : draft));
  }
}

/** The corner icons are created by Leaflet, outside the component's template, so they are found by class. */
function cornersOf(fixture: ComponentFixture<HostComponent>): HTMLElement[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.ichu-map-vertex'));
}

/** Lets the map's asynchronous creation and the pending change detection finish. */
async function settle(fixture: { detectChanges: () => void }): Promise<void> {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.tick();
    fixture.detectChanges();
  }
}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      provideTranslateService({
        loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
        fallbackLang: 'en',
        lang: 'en',
      }),
      LanguageService,
      { provide: LeafletLoader, useValue: { load: () => Promise.resolve(Leaflet) } },
    ],
  });
  TestBed.inject(TranslateService).use('en').subscribe();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('MonitoringMap', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels the map as a region and draws one shape per outline and one dot per position', async () => {
    const fixture = render();
    await settle(fixture);

    const region = fixture.nativeElement.querySelector('[role="region"]');
    expect(region.getAttribute('aria-label')).toBe('Test grazing map');
    expect(fixture.nativeElement.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(2);
  });

  it('draws the boundary being edited as keyboard-operable corners numbered from one', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);

    const corners = cornersOf(fixture);
    expect(corners.map(corner => corner.title)).toEqual(['Vertex 1', 'Vertex 2', 'Vertex 3']);
    expect(corners.every(corner => corner.getAttribute('role') === 'button' && corner.tabIndex === 0)).toBe(true);
  });

  it('reports the index of a corner that is clicked', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);

    cornersOf(fixture)[1].click();

    expect(fixture.componentInstance.removed).toEqual([1]);
  });

  it('reports the index of a corner that is activated with Enter', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);

    cornersOf(fixture)[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(fixture.componentInstance.removed).toEqual([2]);
  });

  it('keeps keyboard focus on the corner that takes the place of a removed one', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);

    cornersOf(fixture)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);

    expect(cornersOf(fixture).map(corner => corner.title)).toEqual(['Vertex 1', 'Vertex 2']);
    expect(document.activeElement?.getAttribute('title')).toBe('Vertex 1');
  });

  it('reports a map click once, ignoring the second click of a double click that would zoom the map', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);
    const canvas = fixture.nativeElement.querySelector('.ichu-map-canvas') as HTMLElement;

    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));

    expect(fixture.componentInstance.clicks).toHaveLength(1);
  });

  it('reads the corners back from the map in their current order', async () => {
    const fixture = render();
    fixture.componentInstance.draft.set({ geofenceId: null, vertices: square });
    await settle(fixture);

    const map = fixture.debugElement.children[0].componentInstance as MonitoringMap;
    expect(map.readDraftVertices()).toEqual(square);
  });

  it('removes its map when it is destroyed', async () => {
    const fixture = render();
    await settle(fixture);
    const canvas = fixture.nativeElement.querySelector('.ichu-map-canvas') as HTMLElement;
    expect(canvas.querySelector('.leaflet-map-pane')).not.toBeNull();

    fixture.destroy();

    expect(canvas.querySelector('.leaflet-map-pane')).toBeNull();
  });
});
