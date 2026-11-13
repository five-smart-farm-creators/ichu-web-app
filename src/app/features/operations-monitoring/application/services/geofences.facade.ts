import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type LotSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { AlertSeverity } from '../../domain/model/alert.model';
import type { Geofence, GeoPoint } from '../../domain/model/geofence.model';
import { GeofenceRepository } from '../../domain/repositories/geofence.repository';

/** The boundary being drawn; `geofenceId` is null while defining a new geofence. */
export interface GeofenceDraft {
  readonly geofenceId: string | null;
  readonly lotId: string | null;
  readonly vertices: readonly GeoPoint[];
}

export interface GeofenceForm {
  readonly lotId: string;
  readonly name: string;
  readonly toleranceMeters: number;
  readonly severity: AlertSeverity;
}

/** Manages the geofences of one ranch and the boundary editor, which draws on the map and saves the drawn vertices. */
@Injectable()
export class GeofencesFacade {
  private readonly geofenceRepository = inject(GeofenceRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;

  readonly geofences = signal<readonly Geofence[]>([]);
  readonly lots = signal<readonly LotSummary[]>([]);
  readonly draft = signal<GeofenceDraft | null>(null);
  readonly error = signal<ApiError | null>(null);
  /** A lot has at most one geofence, so only lots without one can receive a new boundary. */
  readonly lotsWithoutGeofence = computed(() => {
    const covered = new Set(this.geofences().map(geofence => geofence.lotId));
    return this.lots().filter(lot => !covered.has(lot.lotId));
  });

  /** Loads the lots and geofences of a ranch; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.geofences.set([]);
    this.lots.set([]);
    this.draft.set(null);
    this.error.set(null);
    if (!ranchId) return;
    try {
      const [lots, geofences] = await Promise.all([
        this.cattleContext.lotSummaries(ranchId),
        this.geofenceRepository.list(ranchId),
      ]);
      if (ranchId !== this.ranchId) return;
      this.lots.set(lots);
      this.geofences.set(sortByName(geofences));
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  startDefining(lotId: string | null = null): void {
    this.draft.set({ geofenceId: null, lotId, vertices: [] });
  }

  startRedefining(geofence: Geofence): void {
    this.draft.set({ geofenceId: geofence.geofenceId, lotId: geofence.lotId, vertices: geofence.vertices });
  }

  cancelEditing(): void {
    this.draft.set(null);
  }

  /** The map is the editor for vertices, so the saved boundary is read back from it before any change. */
  setVertices(vertices: readonly GeoPoint[]): void {
    this.draft.update(draft => (draft ? { ...draft, vertices } : draft));
  }

  addVertex(point: GeoPoint): void {
    this.draft.update(draft => (draft ? { ...draft, vertices: [...draft.vertices, point] } : draft));
  }

  undoVertex(): void {
    this.draft.update(draft => (draft && draft.vertices.length > 0 ? { ...draft, vertices: draft.vertices.slice(0, -1) } : draft));
  }

  removeVertex(index: number): void {
    this.draft.update(draft => (draft && index >= 0 && index < draft.vertices.length
      ? { ...draft, vertices: draft.vertices.filter((_, position) => position !== index) }
      : draft));
  }

  clearVertices(): void {
    this.draft.update(draft => (draft ? { ...draft, vertices: [] } : draft));
  }

  async save(form: GeofenceForm): Promise<Geofence> {
    const ranchId = this.ranchId;
    const draft = this.draft();
    if (!ranchId || !draft) throw new ApiError(0, 'configuration', null);
    const name = form.name.trim();
    const saved = draft.geofenceId
      ? await this.geofenceRepository.redefine(ranchId, draft.geofenceId, {
        name, toleranceMeters: form.toleranceMeters, severity: form.severity, vertices: draft.vertices,
      })
      : await this.geofenceRepository.define(ranchId, {
        lotId: form.lotId, name, toleranceMeters: form.toleranceMeters, severity: form.severity, vertices: draft.vertices,
      });
    this.geofences.update(geofences => sortByName([...geofences.filter(item => item.geofenceId !== saved.geofenceId), saved]));
    this.draft.set(null);
    return saved;
  }
}

function sortByName(geofences: readonly Geofence[]): Geofence[] {
  return [...geofences].sort((first, second) => first.name.localeCompare(second.name));
}
