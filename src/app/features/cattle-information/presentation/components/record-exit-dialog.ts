import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { CattleProfileFacade } from '../../application/services/cattle-profile.facade';
import {
  type Cattle, earliestEffectiveDay, EXIT_REASONS, type ExitReason, fromIsoDate, toIsoDate, VERSION_CONFLICT,
} from '../../domain/model/cattle.model';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { CATTLE_ERROR_KEYS } from '../cattle-error-keys';
import type { CattleDialogOutcome } from './cattle-dialog';

/** Records an animal's exit after an explicit confirmation; the record stays and becomes read-only. */
@Component({
  selector: 'ichu-record-exit-dialog',
  imports: [
    ApiErrorMessagePipe,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'cattle.exit.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-warning" role="note">{{ 'cattle.exit.warning' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.exit.reason' | translate }}</mat-label>
            <mat-select formControlName="reason">
              @for (reason of reasons; track reason) {
                <mat-option [value]="reason">{{ ('cattle.exitReason.' + reason) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.exit.exitDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="exitPicker" formControlName="exitDate" [min]="minExitDate" [max]="today" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="exitPicker" />
            <mat-datepicker #exitPicker />
            @if (form.controls.exitDate.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.exitDate.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else if (form.controls.exitDate.hasError('matDatepickerMin')) {
              <mat-error>{{ 'cattle.validation.beforeStage' | translate }}</mat-error>
            } @else if (form.controls.exitDate.hasError('matDatepickerMax')) {
              <mat-error>{{ 'cattle.validation.notInFuture' | translate }}</mat-error>
            }
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn danger" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'cattle.exit.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: '.dialog-warning{margin:0 0 16px;padding:12px 14px;border:1px solid color-mix(in srgb, var(--danger) 25%, transparent);border-radius:10px;background:var(--danger-soft);color:var(--danger);font-size:.875rem}.dialog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.dialog-grid mat-form-field{width:100%}@media (max-width:560px){.dialog-grid{grid-template-columns:1fr}}',
})
export class RecordExitDialog {
  readonly errorKeys = CATTLE_ERROR_KEYS;
  private readonly dialogRef = inject<MatDialogRef<RecordExitDialog, CattleDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(CattleProfileFacade);
  private readonly animal = inject<Cattle>(MAT_DIALOG_DATA);
  readonly reasons = EXIT_REASONS;
  readonly today = new Date();
  readonly minExitDate = fromIsoDate(earliestEffectiveDay(this.animal));
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    reason: new FormControl<ExitReason | null>(null, Validators.required),
    exitDate: new FormControl<Date | null>(new Date(), Validators.required),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { reason, exitDate } = this.form.getRawValue();
    if (this.form.invalid || !reason || !exitDate || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.recordExit({ reason, exitDate: toIsoDate(exitDate) });
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
