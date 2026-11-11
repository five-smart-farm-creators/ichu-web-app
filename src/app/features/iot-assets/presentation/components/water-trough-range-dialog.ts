import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { WaterTroughsFacade } from '../../application/services/water-troughs.facade';
import {
  isValidTemperatureRange, TEMPERATURE_MAXIMUM_LIMIT_CELSIUS, TEMPERATURE_MINIMUM_LIMIT_CELSIUS,
  type WaterTrough,
} from '../../domain/model/water-trough.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Saves the temperature band a trough is checked against; both limits are required and the minimum must stay below the maximum. */
@Component({
  selector: 'ichu-water-trough-range-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'waterTroughs.range.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'waterTroughs.range.lead' | translate }}</p>
        <p class="device-serial"><strong>{{ 'waterTroughs.fields.name' | translate }}:</strong> {{ trough.name }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'waterTroughs.fields.minimum' | translate }}</mat-label>
            <input matInput type="number" formControlName="minimumCelsius" step="0.1"
              [min]="minimumLimit" [max]="maximumLimit">
            @if (form.controls.minimumCelsius.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.minimumCelsius.hasError('min') || form.controls.minimumCelsius.hasError('max')) {
              <mat-error>{{ 'waterTroughs.validation.temperatureLimits' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'waterTroughs.fields.maximum' | translate }}</mat-label>
            <input matInput type="number" formControlName="maximumCelsius" step="0.1"
              [min]="minimumLimit" [max]="maximumLimit">
            @if (form.controls.maximumCelsius.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.maximumCelsius.hasError('min') || form.controls.maximumCelsius.hasError('max')) {
              <mat-error>{{ 'waterTroughs.validation.temperatureLimits' | translate }}</mat-error>
            }
          </mat-form-field>
        </div>
        @if (orderError()) {
          <p class="form-error" role="alert">{{ 'waterTroughs.validation.temperatureOrder' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'waterTroughs.range.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: IOT_DIALOG_STYLES,
})
export class WaterTroughRangeDialog {
  private readonly dialogRef = inject<MatDialogRef<WaterTroughRangeDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(WaterTroughsFacade);
  readonly trough = inject<WaterTrough>(MAT_DIALOG_DATA);
  readonly minimumLimit = TEMPERATURE_MINIMUM_LIMIT_CELSIUS;
  readonly maximumLimit = TEMPERATURE_MAXIMUM_LIMIT_CELSIUS;
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly orderError = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    minimumCelsius: new FormControl<number | null>(this.trough.temperatureRange?.minimumCelsius ?? null, [
      Validators.required, Validators.min(TEMPERATURE_MINIMUM_LIMIT_CELSIUS), Validators.max(TEMPERATURE_MAXIMUM_LIMIT_CELSIUS),
    ]),
    maximumCelsius: new FormControl<number | null>(this.trough.temperatureRange?.maximumCelsius ?? null, [
      Validators.required, Validators.min(TEMPERATURE_MINIMUM_LIMIT_CELSIUS), Validators.max(TEMPERATURE_MAXIMUM_LIMIT_CELSIUS),
    ]),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { minimumCelsius, maximumCelsius } = this.form.getRawValue();
    if (this.form.invalid || minimumCelsius === null || maximumCelsius === null || this.saving()) return;
    const range = { minimumCelsius, maximumCelsius };
    this.orderError.set(!isValidTemperatureRange(range));
    if (this.orderError()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.configureTemperatureRange(this.trough.id, range);
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
