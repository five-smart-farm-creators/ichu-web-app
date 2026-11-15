import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { DeviceInventoryFacade } from '../../application/services/device-inventory.facade';
import type { Device } from '../../domain/model/device.model';
import { VERSION_CONFLICT } from '../../domain/model/version-conflict';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Connects an unassigned collar to an active animal that has none; the list offers only animals the API accepts. */
@Component({
  selector: 'ichu-assign-device-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'devices.assign.collarTitle' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'devices.assign.collarLead' | translate }}</p>
        <p class="device-serial"><strong>{{ 'devices.fields.serial' | translate }}:</strong> {{ device.serial }}</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'devices.assign.animal' | translate }}</mat-label>
          <mat-select formControlName="targetId">
            @for (animal of animals(); track animal.cattleId) {
              <mat-option [value]="animal.cattleId">{{ animal.earTag }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ 'common.required' | translate }}</mat-error>
        </mat-form-field>
        @if (!hasTargets()) {
          <p class="text-muted">{{ 'devices.assign.noAnimals' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving() || !hasTargets()">
          {{ (saving() ? 'common.saving' : 'devices.assign.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: IOT_DIALOG_STYLES,
})
export class AssignDeviceDialog {
  private readonly dialogRef = inject<MatDialogRef<AssignDeviceDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(DeviceInventoryFacade);
  readonly device = inject<Device>(MAT_DIALOG_DATA);
  readonly animals = this.facade.assignableCattle;
  readonly hasTargets = computed(() => this.animals().length > 0);
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    targetId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { targetId } = this.form.getRawValue();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.assign(this.device.id, targetId);
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
