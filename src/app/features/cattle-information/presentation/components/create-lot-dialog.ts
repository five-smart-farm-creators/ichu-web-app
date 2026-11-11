import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { LotsFacade } from '../../application/services/lots.facade';
import { LOT_CRITERION_MAX_LENGTH, LOT_NAME_MAX_LENGTH } from '../../domain/model/lot.model';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { CATTLE_ERROR_KEYS } from '../cattle-error-keys';
import type { CattleDialogOutcome } from './cattle-dialog';

/** Creates a management group; the criterion is optional and only describes how the group was formed. */
@Component({
  selector: 'ichu-create-lot-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'cattle.lots.createTitle' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.name' | translate }}</mat-label>
            <input matInput formControlName="name" autocomplete="off" [maxlength]="maxNameLength">
            @if (form.controls.name.hasError('required') || form.controls.name.hasError('pattern')) {
              <mat-error>{{ 'cattle.validation.lotNameRequired' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.criterion' | translate }}</mat-label>
            <input matInput formControlName="criterion" autocomplete="off" [maxlength]="maxCriterionLength">
            <mat-hint align="end">{{ 'cattle.lots.criterionHint' | translate }}</mat-hint>
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'cattle.lots.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: '.dialog-grid{display:grid;gap:4px}.dialog-grid mat-form-field{width:100%}',
})
export class CreateLotDialog {
  readonly errorKeys = CATTLE_ERROR_KEYS;
  private readonly dialogRef = inject<MatDialogRef<CreateLotDialog, CattleDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(LotsFacade);
  readonly maxNameLength = LOT_NAME_MAX_LENGTH;
  readonly maxCriterionLength = LOT_CRITERION_MAX_LENGTH;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LOT_NAME_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
    criterion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LOT_CRITERION_MAX_LENGTH)],
    }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { name, criterion } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.create({ name: name.trim(), criterion: criterion.trim() || undefined });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
