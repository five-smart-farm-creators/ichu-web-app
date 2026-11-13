import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { DeviceInventoryFacade } from '../../application/services/device-inventory.facade';
import {
  DEVICE_SERIAL_MAX_LENGTH, DEVICE_TYPES, type DeviceType, FIRMWARE_VERSION_MAX_LENGTH,
} from '../../domain/model/device.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Adds a collar or water controller to the ranch; the dialog stays open when the API refuses the serial. */
@Component({
  selector: 'ichu-register-device-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'devices.register.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'devices.register.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'devices.fields.serial' | translate }}</mat-label>
            <input matInput formControlName="serial" autocomplete="off" spellcheck="false" [maxlength]="maxSerialLength">
            @if (form.controls.serial.hasError('required') || form.controls.serial.hasError('pattern')) {
              <mat-error>{{ 'devices.validation.serialRequired' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'devices.fields.type' | translate }}</mat-label>
            <mat-select formControlName="type">
              @for (type of types; track type) {
                <mat-option [value]="type">{{ ('devices.type.' + type) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'devices.fields.firmware' | translate }}</mat-label>
            <input matInput formControlName="firmwareVersion" autocomplete="off" spellcheck="false" [maxlength]="maxFirmwareLength">
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'devices.register.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: IOT_DIALOG_STYLES,
})
export class RegisterDeviceDialog {
  private readonly dialogRef = inject<MatDialogRef<RegisterDeviceDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(DeviceInventoryFacade);
  readonly types = DEVICE_TYPES;
  readonly maxSerialLength = DEVICE_SERIAL_MAX_LENGTH;
  readonly maxFirmwareLength = FIRMWARE_VERSION_MAX_LENGTH;
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    serial: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(DEVICE_SERIAL_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
    type: new FormControl<DeviceType | null>(null, Validators.required),
    firmwareVersion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(FIRMWARE_VERSION_MAX_LENGTH)],
    }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { serial, type, firmwareVersion } = this.form.getRawValue();
    if (this.form.invalid || !type || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const firmware = firmwareVersion.trim();
      await this.facade.register({
        serial: serial.trim(),
        type,
        ...(firmware ? { firmwareVersion: firmware } : {}),
      });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
