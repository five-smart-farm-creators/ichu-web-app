import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { GoogleMapsLoader } from '../../../../shared/infrastructure/maps/google-maps-loader';
import { AlertsFacade } from '../../application/services/alerts.facade';
import { type Alert, ALERT_TEXT_MAX_LENGTH } from '../../domain/model/alert.model';
import type { Geofence } from '../../domain/model/geofence.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { MONITORING_ERROR_KEYS } from '../monitoring-error-keys';
import { durationParts, formatMeasure } from '../monitoring-format';
import { MONITORING_DIALOG_STYLES, type MonitoringDialogOutcome } from './monitoring-dialog';
import { type MapMarker, type MapOutline, MonitoringMap } from './monitoring-map';

/** What the drawer needs: the alert, its ear tag, its geofence when it has one, and whether the viewer may acknowledge it. */
export interface AlertDialogData {
  readonly alert: Alert;
  readonly earTag: string;
  readonly geofence: Geofence | null;
  readonly canManage: boolean;
}

/** Shows one alert against its thresholds or geofence, and records the attention given to it. */
@Component({
  selector: 'ichu-alert-detail-dialog',
  imports: [ApiErrorMessagePipe, LocalizedDatePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MonitoringMap, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'monitoring.alerts.detail.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dialog-lead">
        {{ 'monitoring.alerts.detail.animal' | translate: { earTag: data.earTag } }}
      </p>
      <dl class="dialog-facts">
        <div>
          <dt>{{ 'monitoring.fields.raisedAt' | translate }}</dt>
          <dd>{{ data.alert.raisedAt | localizedDate: 'medium' }}</dd>
        </div>
        <div>
          <dt>{{ 'monitoring.fields.type' | translate }}</dt>
          <dd>{{ ('monitoring.alertType.' + data.alert.type) | translate }}</dd>
        </div>
        <div>
          <dt>{{ 'monitoring.fields.severity' | translate }}</dt>
          <dd>{{ ('monitoring.severity.' + data.alert.severity) | translate }}</dd>
        </div>
        <div>
          <dt>{{ 'monitoring.fields.status' | translate }}</dt>
          <dd>{{ ('monitoring.alertStatus.' + data.alert.status) | translate }}</dd>
        </div>
        @if (data.alert.type === 'Geofence') {
          <div>
            <dt>{{ 'monitoring.fields.geofence' | translate }}</dt>
            <dd>{{ data.geofence?.name ?? ('monitoring.fields.unknownGeofence' | translate) }}</dd>
          </div>
          <div>
            <dt>{{ 'monitoring.fields.distanceToBoundary' | translate }}</dt>
            <dd>{{ distanceText() }} {{ 'monitoring.units.meters' | translate }}</dd>
          </div>
          @if (exitDuration(); as parts) {
            <div>
              <dt>{{ 'monitoring.fields.outsideFor' | translate }}</dt>
              <dd>{{ parts.amount }} {{ ('monitoring.duration.' + parts.unit) | translate }}</dd>
            </div>
          }
        } @else {
          <div>
            <dt>{{ 'monitoring.fields.detectedValue' | translate }}</dt>
            <dd>{{ detectedText() }} {{ ('monitoring.units.' + data.alert.unit) | translate }}</dd>
          </div>
          <div>
            <dt>{{ 'monitoring.fields.normalRange' | translate }}</dt>
            <dd>{{ rangeText() }} {{ ('monitoring.units.' + data.alert.unit) | translate }}</dd>
          </div>
        }
      </dl>

      @if (hasPosition) {
        @if (mapState() === 'ready') {
          <ichu-monitoring-map class="alert-map" height="240px" [outlines]="outlines" [markers]="markers"
            [center]="center" [zoom]="16" [accessibleLabel]="'monitoring.alerts.detail.mapLabel' | translate" />
        } @else if (mapState() === 'unavailable') {
          <p class="notice" role="note">{{ 'monitoring.map.unavailable' | translate }}</p>
        }
      }

      @if (data.alert.status === 'Acknowledged') {
        <dl class="dialog-facts">
          <div>
            <dt>{{ 'monitoring.fields.finding' | translate }}</dt>
            <dd>{{ data.alert.finding }}</dd>
          </div>
          <div>
            <dt>{{ 'monitoring.fields.action' | translate }}</dt>
            <dd>{{ data.alert.action || ('monitoring.fields.noAction' | translate) }}</dd>
          </div>
          <div>
            <dt>{{ 'monitoring.fields.acknowledgedAt' | translate }}</dt>
            <dd>{{ data.alert.acknowledgedAt | localizedDate: 'medium' }}</dd>
          </div>
          @if (responseTime(); as parts) {
            <div>
              <dt>{{ 'monitoring.fields.responseTime' | translate }}</dt>
              <dd>{{ parts.amount }} {{ ('monitoring.duration.' + parts.unit) | translate }}</dd>
            </div>
          }
        </dl>
      }

      @if (canAcknowledge) {
        <form [formGroup]="form" id="acknowledge-form" (ngSubmit)="acknowledge()" novalidate>
          <div class="dialog-grid">
            <mat-form-field appearance="outline" class="span-two">
              <mat-label>{{ 'monitoring.fields.finding' | translate }}</mat-label>
              <textarea matInput formControlName="finding" rows="3" [maxlength]="maxLength"></textarea>
              <mat-hint align="end">{{ form.controls.finding.value.length }} / {{ maxLength }}</mat-hint>
              @if (form.controls.finding.hasError('required')) {
                <mat-error>{{ 'monitoring.validation.findingRequired' | translate }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="span-two">
              <mat-label>{{ 'monitoring.fields.action' | translate }}</mat-label>
              <textarea matInput formControlName="action" rows="2" [maxlength]="maxLength"></textarea>
              <mat-hint align="end">{{ form.controls.action.value.length }} / {{ maxLength }}</mat-hint>
            </mat-form-field>
          </div>
          @if (error(); as apiError) {
            <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
          }
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.close' | translate }}</button>
      @if (canAcknowledge) {
        <button type="submit" form="acknowledge-form" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'monitoring.alerts.acknowledge') | translate }}
        </button>
      }
    </mat-dialog-actions>`,
  styles: MONITORING_DIALOG_STYLES + '.alert-map{display:block;margin:0 0 18px}',
})
export class AlertDetailDialog {
  readonly errorKeys = MONITORING_ERROR_KEYS;
  readonly maxLength = ALERT_TEXT_MAX_LENGTH;
  readonly data = inject<AlertDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AlertDetailDialog, MonitoringDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(AlertsFacade);
  private readonly language = inject(LanguageService);
  private readonly loader = inject(GoogleMapsLoader);
  readonly mapState = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly canAcknowledge = this.data.canManage && this.data.alert.status === 'Pending';
  readonly hasPosition = this.data.alert.latitude !== null && this.data.alert.longitude !== null;
  readonly center = { latitude: this.data.alert.latitude ?? 0, longitude: this.data.alert.longitude ?? 0 };
  readonly markers: MapMarker[] = this.hasPosition
    ? [{ id: this.data.alert.alertId, title: this.data.earTag, position: this.center }]
    : [];
  readonly outlines: MapOutline[] = this.data.geofence
    ? [{ id: this.data.geofence.geofenceId, vertices: this.data.geofence.vertices }]
    : [];
  readonly locale = computed(() => formatLocaleTag(this.language.current()));
  readonly detectedText = computed(() => formatMeasure(this.data.alert.detectedValue, this.locale()));
  readonly distanceText = computed(() => formatMeasure(this.data.alert.distanceToBoundaryMeters, this.locale(), 0));
  readonly rangeText = computed(() => `${formatMeasure(this.data.alert.thresholdMinValue, this.locale())} – ${formatMeasure(this.data.alert.thresholdMaxValue, this.locale())}`);
  readonly exitDuration = computed(() => durationParts(this.data.alert.exitDurationSeconds, this.locale()));
  readonly responseTime = computed(() => durationParts(this.data.alert.responseTimeSeconds, this.locale()));
  readonly form = new FormGroup({
    finding: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(ALERT_TEXT_MAX_LENGTH)] }),
    action: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(ALERT_TEXT_MAX_LENGTH)] }),
  });

  constructor() {
    if (this.hasPosition) {
      this.loader.load().then(() => this.mapState.set('ready'), () => this.mapState.set('unavailable'));
    }
  }

  async acknowledge(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { finding, action } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.acknowledge(this.data.alert, { finding: finding.trim(), action: action.trim() || null });
      this.dialogRef.close('saved');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) {
        this.dialogRef.close('conflict');
      } else {
        this.error.set(apiError);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
