import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { DeviceInventoryFacade } from '../../application/services/device-inventory.facade';
import { type Device, RELEASE_REASON_MAX_LENGTH } from '../../domain/model/device.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Ends a device's current assignment with a reason; the device keeps its history and becomes available again. */
@Component({
  selector: 'ichu-release-device-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'devices.release.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-warning" role="note">{{ 'devices.release.warning' | translate }}</p>
        <p class="device-serial"><strong>{{ 'devices.fields.serial' | translate }}:</strong> {{ device.serial }}</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'devices.release.reason' | translate }}</mat-label>
          <input matInput formControlName="reason" autocomplete="off" [maxlength]="maxReasonLength">
          @if (form.controls.reason.hasError('required') || form.controls.reason.hasError('pattern')) {
            <mat-error>{{ 'devices.validation.reasonRequired' | translate }}</mat-error>
          }
        </mat-form-field>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn danger" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'devices.release.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: IOT_DIALOG_STYLES,
})
export class ReleaseDeviceDialog {
  private readonly dialogRef = inject<MatDialogRef<ReleaseDeviceDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(DeviceInventoryFacade);
  readonly device = inject<Device>(MAT_DIALOG_DATA);
  readonly maxReasonLength = RELEASE_REASON_MAX_LENGTH;
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(RELEASE_REASON_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { reason } = this.form.getRawValue();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.release(this.device.id, reason);
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
