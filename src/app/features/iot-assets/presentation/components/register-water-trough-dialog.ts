import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { WaterTroughsFacade } from '../../application/services/water-troughs.facade';
import { WATER_TROUGH_NAME_MAX_LENGTH } from '../../domain/model/water-trough.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Adds a water trough to the ranch; a lot link is optional and registering does not use a collar. */
@Component({
  selector: 'ichu-register-water-trough-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'waterTroughs.register.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'waterTroughs.register.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'waterTroughs.fields.name' | translate }}</mat-label>
            <input matInput formControlName="name" autocomplete="off" [maxlength]="maxNameLength">
            @if (form.controls.name.hasError('required') || form.controls.name.hasError('pattern')) {
              <mat-error>{{ 'waterTroughs.validation.nameRequired' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'waterTroughs.fields.lot' | translate }}</mat-label>
            <mat-select formControlName="lotId">
              <mat-option value="">{{ 'waterTroughs.noLot' | translate }}</mat-option>
              @for (lot of facade.lots(); track lot.lotId) {
                <mat-option [value]="lot.lotId">{{ lot.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'waterTroughs.register.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: IOT_DIALOG_STYLES,
})
export class RegisterWaterTroughDialog {
  private readonly dialogRef = inject<MatDialogRef<RegisterWaterTroughDialog, IotDialogOutcome>>(MatDialogRef);
  readonly facade = inject(WaterTroughsFacade);
  readonly maxNameLength = WATER_TROUGH_NAME_MAX_LENGTH;
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(WATER_TROUGH_NAME_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
    lotId: new FormControl('', { nonNullable: true }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { name, lotId } = this.form.getRawValue();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.register({ name: name.trim(), ...(lotId ? { lotId } : {}) });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
