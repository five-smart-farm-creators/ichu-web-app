import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiError, toApiError } from '../../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PluralPipe } from '../../../../../shared/presentation/plural.pipe';
import { LeafletLoader } from '../../../../../shared/infrastructure/maps/leaflet-loader';
import { GeofencesFacade } from '../../../application/services/geofences.facade';
import { HERD_LATEST_LIMIT, HerdMonitoringFacade, type HerdRow } from '../../../application/services/herd-monitoring.facade';
import { ALERT_SEVERITIES, type AlertSeverity } from '../../../domain/model/alert.model';
import {
  GEOFENCE_NAME_MAX_LENGTH, GEOFENCE_TOLERANCE_MAX_METERS, type Geofence, type GeoPoint, isValidGeofenceName,
  isValidGeofenceTolerance, isValidGeofenceVertexCount, GEOFENCE_MIN_VERTICES,
} from '../../../domain/model/geofence.model';
import { MonitoringMap, type MapMarker, type MapOutline } from '../../components/monitoring-map';
import { MONITORING_ERROR_KEYS } from '../../monitoring-error-keys';
import { formatMeasure } from '../../monitoring-format';

const DEFAULT_TOLERANCE_METERS = 15;

/** Shows the geofences of each lot and the last known positions on a map, with tables that list the same data. */
@Component({
  selector: 'ichu-locations-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MonitoringMap,
    PluralPipe,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [HerdMonitoringFacade, GeofencesFacade],
  templateUrl: './locations-page.html',
  styleUrl: './locations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsPage {
  readonly herd = inject(HerdMonitoringFacade);
  readonly geofences = inject(GeofencesFacade);
  readonly context = inject(IamContextFacade);
  private readonly loader = inject(LeafletLoader);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly mapView = viewChild(MonitoringMap);
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly herdLimit = HERD_LATEST_LIMIT;
  readonly severities = ALERT_SEVERITIES;
  readonly minimumCorners = GEOFENCE_MIN_VERTICES;
  readonly toleranceMaximum = GEOFENCE_TOLERANCE_MAX_METERS;
  readonly nameMaxLength = GEOFENCE_NAME_MAX_LENGTH;
  readonly geofenceColumns = ['name', 'lot', 'tolerance', 'severity', 'corners', 'actions'];
  readonly positionColumns = ['earTag', 'position', 'recordedAt', 'freshness'];
  readonly mapState = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly notice = signal<string | null>(null);
  readonly saving = signal(false);
  readonly cornerError = signal(false);
  readonly toleranceError = signal(false);
  readonly nameError = signal(false);
  readonly editorError = signal<ApiError | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly editing = computed(() => this.geofences.draft() !== null);
  readonly drawingNew = computed(() => {
    const draft = this.geofences.draft();
    return draft !== null && draft.geofenceId === null;
  });
  readonly draftCorners = computed(() => this.geofences.draft()?.vertices ?? null);
  readonly draftCount = computed(() => this.draftCorners()?.length ?? 0);
  readonly lotOptions = computed(() => (this.drawingNew() ? this.geofences.lotsWithoutGeofence() : this.geofences.lots()));
  readonly lotGeofences = computed(() => {
    const lotId = this.herd.lotId();
    return this.geofences.geofences().filter(geofence => !lotId || geofence.lotId === lotId);
  });
  /** Independent of the draft, so the map refits only when the lot or saved geofences change, never while drawing. */
  readonly outlines = computed<MapOutline[]>(() => this.lotGeofences().map(geofence => ({
    id: geofence.geofenceId,
    title: geofence.name,
    toleranceMeters: geofence.toleranceMeters,
    vertices: geofence.vertices,
  })));
  readonly markers = computed<MapMarker[]>(() => this.herd.rows().flatMap(row => {
    const marker = markerOf(row);
    return marker ? [marker] : [];
  }));
  readonly form = new FormGroup({
    lotId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(GEOFENCE_NAME_MAX_LENGTH)] }),
    toleranceMeters: new FormControl<number | null>(DEFAULT_TOLERANCE_METERS, [
      Validators.required, Validators.min(1), Validators.max(GEOFENCE_TOLERANCE_MAX_METERS),
    ]),
    severity: new FormControl<AlertSeverity>('Warning', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.notice.set(null);
        this.editorError.set(null);
        this.geofences.cancelEditing();
        void this.herd.open(ranchId);
        void this.geofences.open(ranchId);
      });
    });
    this.loader.load().then(() => this.mapState.set('ready'), () => this.mapState.set('unavailable'));
  }

  selectLot(lotId: string): void {
    void this.herd.selectLot(lotId || null);
  }

  startDefining(): void {
    this.resetEditorErrors();
    this.form.controls.lotId.enable();
    this.form.reset({
      lotId: this.herd.lotId() ?? this.geofences.lotsWithoutGeofence()[0]?.lotId ?? '',
      name: '',
      toleranceMeters: DEFAULT_TOLERANCE_METERS,
      severity: 'Warning',
    });
    this.geofences.startDefining(this.herd.lotId());
  }

  startRedefining(geofence: Geofence): void {
    this.resetEditorErrors();
    this.geofences.startRedefining(geofence);
    this.form.reset({
      lotId: geofence.lotId,
      name: geofence.name,
      toleranceMeters: geofence.toleranceMeters,
      severity: geofence.severity,
    });
    this.form.controls.lotId.disable();
  }

  cancel(): void {
    this.geofences.cancelEditing();
    this.form.controls.lotId.enable();
    this.editorError.set(null);
  }

  /** A click adds a corner; corners the user dragged are read back first so none of them are lost. */
  onMapClick(point: GeoPoint): void {
    if (!this.geofences.draft()) return;
    this.syncCornersFromMap();
    this.geofences.addVertex(point);
  }

  undo(): void {
    this.syncCornersFromMap();
    this.geofences.undoVertex();
  }

  clearCorners(): void {
    this.geofences.clearVertices();
  }

  /** Corners dragged on the map are read back first, so the remaining ones keep their dragged positions. */
  removeCorner(index: number): void {
    this.syncCornersFromMap();
    this.geofences.removeVertex(index);
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.syncCornersFromMap();
    const draft = this.geofences.draft();
    if (!draft || this.saving()) return;
    const { lotId, name, toleranceMeters, severity } = this.form.getRawValue();
    const tolerance = toleranceMeters ?? Number.NaN;
    this.cornerError.set(!isValidGeofenceVertexCount(draft.vertices.length));
    this.toleranceError.set(!isValidGeofenceTolerance(tolerance));
    this.nameError.set(!isValidGeofenceName(name));
    const lotMissing = !lotId && draft.geofenceId === null;
    if (this.cornerError() || this.toleranceError() || this.nameError() || this.form.invalid || lotMissing) return;
    this.saving.set(true);
    this.editorError.set(null);
    try {
      await this.geofences.save({ lotId, name, toleranceMeters: tolerance, severity });
      this.form.controls.lotId.enable();
      this.notice.set('locations.editor.saved');
    } catch (error) {
      this.editorError.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Lot names are shown instead of identifiers in every table and export. */
  lotName(lotId: string): string {
    return this.geofences.lots().find(lot => lot.lotId === lotId)?.name ?? '';
  }

  /** Coordinates of a last known position, or null when the animal has none. */
  coordinatesOf(row: HerdRow): string | null {
    const position = positionOf(row);
    if (!position) return null;
    const locale = this.dateLocale();
    return `${formatMeasure(position.latitude, locale, 5)}, ${formatMeasure(position.longitude, locale, 5)}`;
  }

  positionStatus(row: HerdRow): string {
    if (row.failed) return 'locations.positions.failed';
    if (!row.latest) return 'locations.positions.noPosition';
    return row.latest.lastKnownPosition.status === 'Available' ? 'locations.positions.known' : 'locations.positions.noPosition';
  }

  /** A position older than 24 hours is labelled stale rather than presented as the current location. */
  freshness(row: HerdRow): { readonly key: string; readonly tone: string } | null {
    const position = row.latest?.lastKnownPosition;
    if (!position || position.status !== 'Available') return null;
    return position.isStale
      ? { key: 'locations.positions.stale', tone: 'warning' }
      : { key: 'locations.positions.current', tone: 'success' };
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.lotGeofences();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-geofences', columns, rows);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.locations');
        await this.exportService.exportPdf('ichu-geofences', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private syncCornersFromMap(): void {
    const vertices = this.mapView()?.readDraftVertices();
    if (vertices) this.geofences.setVertices(vertices);
  }

  private resetEditorErrors(): void {
    this.notice.set(null);
    this.editorError.set(null);
    this.cornerError.set(false);
    this.toleranceError.set(false);
    this.nameError.set(false);
  }

  private exportColumns(): ExportColumn<Geofence>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('monitoring.geofences.name'), value: geofence => geofence.name },
      { header: text('cattle.fields.lot'), value: geofence => this.lotName(geofence.lotId) },
      { header: text('monitoring.fields.tolerance'), value: geofence => geofence.toleranceMeters },
      { header: text('monitoring.fields.severity'), value: geofence => text('monitoring.severity.' + geofence.severity) },
      { header: text('monitoring.geofences.corners'), value: geofence => geofence.vertices.length },
    ];
  }
}

/** The last known position of an animal when the API reports one with coordinates. */
function positionOf(row: HerdRow): GeoPoint | null {
  const position = row.latest?.lastKnownPosition;
  if (!position || position.status !== 'Available' || position.latitude === null || position.longitude === null) return null;
  return { latitude: position.latitude, longitude: position.longitude };
}

/** The map marker of an animal with a known position; the freshness flag lets the map mute an old position. */
function markerOf(row: HerdRow): MapMarker | null {
  const position = positionOf(row);
  if (!position) return null;
  const known = row.latest?.lastKnownPosition;
  return {
    id: row.animal.cattleId,
    title: row.animal.earTag,
    position,
    recordedAt: known?.recordedAt ?? null,
    stale: known?.isStale === true,
  };
}
