import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { CattleInventoryFacade } from '../../application/services/cattle-inventory.facade';
import {
  CATTLE_BREEDS, CATTLE_SEXES, type CattleBreed, type CattleSex, EAR_TAG_MAX_LENGTH, LIFE_STAGES, type LifeStage,
  toIsoDate,
} from '../../domain/model/cattle.model';
import { CattleErrorMessagePipe } from '../pipes/cattle-error-message.pipe';

/** Adds an animal to the ranch; the dialog stays open when the API refuses the record, such as a duplicate ear tag. */
@Component({
  selector: 'ichu-register-cattle-dialog',
  imports: [
    CattleErrorMessagePipe,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'cattle.register.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'cattle.register.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.earTag' | translate }}</mat-label>
            <input matInput formControlName="earTag" autocomplete="off" spellcheck="false" [maxlength]="maxEarTagLength">
            @if (form.controls.earTag.hasError('required') || form.controls.earTag.hasError('pattern')) {
              <mat-error>{{ 'cattle.validation.earTagRequired' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.birthDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="birthPicker" formControlName="birthDate" [max]="today" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="birthPicker" />
            <mat-datepicker #birthPicker />
            @if (form.controls.birthDate.hasError('required')) {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            } @else if (form.controls.birthDate.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else if (form.controls.birthDate.hasError('matDatepickerMax')) {
              <mat-error>{{ 'cattle.validation.notInFuture' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.breed' | translate }}</mat-label>
            <mat-select formControlName="breed">
              @for (breed of breeds; track breed) {
                <mat-option [value]="breed">{{ ('cattle.breed.' + breed) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'cattle.fields.sex' | translate }}</mat-label>
            <mat-select formControlName="sex">
              @for (sex of sexes; track sex) {
                <mat-option [value]="sex">{{ ('cattle.sex.' + sex) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'cattle.fields.stage' | translate }}</mat-label>
            <mat-select formControlName="lifeStage">
              @for (stage of stages; track stage) {
                <mat-option [value]="stage">{{ ('cattle.stage.' + stage) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | cattleError }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'cattle.register.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: '.dialog-lead{margin:0 0 16px;color:var(--muted);font-size:.875rem}.dialog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.dialog-grid mat-form-field{width:100%}.span-two{grid-column:1/-1}@media (max-width:560px){.dialog-grid{grid-template-columns:1fr}}',
})
export class RegisterCattleDialog {
  private readonly dialogRef = inject<MatDialogRef<RegisterCattleDialog, 'saved'>>(MatDialogRef);
  private readonly facade = inject(CattleInventoryFacade);
  readonly breeds = CATTLE_BREEDS;
  readonly sexes = CATTLE_SEXES;
  readonly stages = LIFE_STAGES;
  readonly maxEarTagLength = EAR_TAG_MAX_LENGTH;
  readonly today = new Date();
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    earTag: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(EAR_TAG_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
    birthDate: new FormControl<Date | null>(null, Validators.required),
    breed: new FormControl<CattleBreed | null>(null, Validators.required),
    sex: new FormControl<CattleSex | null>(null, Validators.required),
    lifeStage: new FormControl<LifeStage | null>(null, Validators.required),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { earTag, birthDate, breed, sex, lifeStage } = this.form.getRawValue();
    if (this.form.invalid || !birthDate || !breed || !sex || !lifeStage || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.register({
        earTag: earTag.trim(),
        birthDate: toIsoDate(birthDate),
        breed,
        sex,
        lifeStage,
      });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
