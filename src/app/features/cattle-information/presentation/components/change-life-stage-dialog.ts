import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { CattleProfileFacade } from '../../application/services/cattle-profile.facade';
import {
  type Cattle, earliestEffectiveDay, fromIsoDate, LIFE_STAGES, type LifeStage, toIsoDate, VERSION_CONFLICT,
} from '../../domain/model/cattle.model';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { CATTLE_ERROR_KEYS } from '../cattle-error-keys';
import type { CattleDialogOutcome } from './cattle-dialog';

/** Rejects the stage the animal already has, which the API would refuse with a conflict. */
function differentFrom(current: LifeStage): ValidatorFn {
  return control => (control.value === current ? { sameStage: true } : null);
}

/** Records a new productive stage from a date; the previous stage stays in the history. */
@Component({
  selector: 'ichu-change-life-stage-dialog',
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
  template: `<h2 mat-dialog-title>{{ 'cattle.lifeStage.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'cattle.lifeStage.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.lifeStage.newStage' | translate }}</mat-label>
            <mat-select formControlName="lifeStage">
              @for (stage of stages; track stage) {
                <mat-option [value]="stage">{{ ('cattle.stage.' + stage) | translate }}</mat-option>
              }
            </mat-select>
            @if (form.controls.lifeStage.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.lifeStage.hasError('sameStage')) {
              <mat-error>{{ 'cattle.validation.stageUnchanged' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.lifeStage.validFrom' | translate }}</mat-label>
            <input matInput [matDatepicker]="fromPicker" formControlName="validFrom" [min]="minValidFrom" [max]="today" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
            @if (form.controls.validFrom.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.validFrom.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else if (form.controls.validFrom.hasError('matDatepickerMin')) {
              <mat-error>{{ 'cattle.validation.beforeStage' | translate }}</mat-error>
            } @else if (form.controls.validFrom.hasError('matDatepickerMax')) {
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
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'cattle.lifeStage.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: '.dialog-lead{margin:0 0 16px;color:var(--muted);font-size:.875rem}.dialog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.dialog-grid mat-form-field{width:100%}@media (max-width:560px){.dialog-grid{grid-template-columns:1fr}}',
})
export class ChangeLifeStageDialog {
  readonly errorKeys = CATTLE_ERROR_KEYS;
  private readonly dialogRef = inject<MatDialogRef<ChangeLifeStageDialog, CattleDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(CattleProfileFacade);
  private readonly animal = inject<Cattle>(MAT_DIALOG_DATA);
  readonly stages = LIFE_STAGES;
  readonly today = new Date();
  readonly minValidFrom = fromIsoDate(earliestEffectiveDay(this.animal));
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    lifeStage: new FormControl<LifeStage | null>(null, [Validators.required, differentFrom(this.animal.currentStage)]),
    validFrom: new FormControl<Date | null>(new Date(), Validators.required),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { lifeStage, validFrom } = this.form.getRawValue();
    if (this.form.invalid || !lifeStage || !validFrom || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.changeLifeStage({ lifeStage, validFrom: toIsoDate(validFrom) });
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
