import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { MonitoringThresholdsFacade } from '../../application/services/monitoring-thresholds.facade';
import {
  type ConfigureThreshold, isValidThresholdRange, levelsAreNested, type MonitoringThreshold,
  THRESHOLD_LIFE_STAGES, THRESHOLD_SEVERITIES, type ThresholdSeverity,
} from '../../domain/model/monitoring-threshold.model';
import { MONITORED_METRICS, type MonitoredMetric } from '../../domain/model/telemetry.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { MONITORING_ERROR_KEYS } from '../monitoring-error-keys';
import { MONITORING_DIALOG_STYLES, type MonitoringDialogOutcome } from './monitoring-dialog';

/** Saves the normal range of one stage, metric and severity; both limits are required and the minimum must stay below the maximum. */
@Component({
  selector: 'ichu-threshold-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'monitoring.thresholds.dialog.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'monitoring.thresholds.dialog.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'monitoring.fields.lifeStage' | translate }}</mat-label>
            <mat-select formControlName="lifeStage">
              @for (stage of lifeStages; track stage) {
                <mat-option [value]="stage">{{ ('cattle.stage.' + stage) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'monitoring.fields.metric' | translate }}</mat-label>
            <mat-select formControlName="metric">
              @for (metric of metrics; track metric) {
                <mat-option [value]="metric">{{ ('monitoring.metric.' + metric) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'monitoring.fields.minValue' | translate }}</mat-label>
            <input matInput type="number" formControlName="minValue" step="any">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'monitoring.fields.maxValue' | translate }}</mat-label>
            <input matInput type="number" formControlName="maxValue" step="any">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'monitoring.fields.severity' | translate }}</mat-label>
            <mat-select formControlName="severity">
              @for (severity of severities; track severity) {
                <mat-option [value]="severity">{{ ('monitoring.severity.' + severity) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
        </div>
        @if (orderError()) {
          <p class="form-error" role="alert">{{ 'monitoring.validation.rangeOrder' | translate }}</p>
        }
        @if (levelsError()) {
          <p class="form-error" role="alert">{{ 'monitoring.validation.thresholdLevels' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'monitoring.thresholds.dialog.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: MONITORING_DIALOG_STYLES,
})
export class ThresholdDialog {
  readonly errorKeys = MONITORING_ERROR_KEYS;
  private readonly dialogRef = inject<MatDialogRef<ThresholdDialog, MonitoringDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(MonitoringThresholdsFacade);
  private readonly existing = inject<MonitoringThreshold | null>(MAT_DIALOG_DATA);
  readonly lifeStages = THRESHOLD_LIFE_STAGES;
  readonly metrics = MONITORED_METRICS;
  readonly severities = THRESHOLD_SEVERITIES;
  readonly saving = signal(false);
  readonly orderError = signal(false);
  readonly levelsError = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    lifeStage: new FormControl<string | null>(this.existing?.lifeStage ?? null, Validators.required),
    metric: new FormControl<MonitoredMetric | null>(this.existing?.metric ?? null, Validators.required),
    minValue: new FormControl<number | null>(this.existing?.minValue ?? null, Validators.required),
    maxValue: new FormControl<number | null>(this.existing?.maxValue ?? null, Validators.required),
    severity: new FormControl<ThresholdSeverity | null>(this.existing?.severity ?? 'Warning', Validators.required),
  });

  constructor() {
    // The stage, metric and severity identify the threshold, so an edit cannot move it to another level.
    if (this.existing) {
      this.form.controls.lifeStage.disable();
      this.form.controls.metric.disable();
      this.form.controls.severity.disable();
    }
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { lifeStage, metric, minValue, maxValue, severity } = this.form.getRawValue();
    if (this.form.invalid || !lifeStage || !metric || minValue === null || maxValue === null || !severity || this.saving()) return;
    const request: ConfigureThreshold = { lifeStage, metric, minValue, maxValue, severity };
    this.orderError.set(!isValidThresholdRange(minValue, maxValue));
    this.levelsError.set(!this.orderError() && !levelsAreNested(this.facade.thresholds(), request));
    if (this.orderError() || this.levelsError()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.configure(request);
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
