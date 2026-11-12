import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import type { MonitoredCattleSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { combineDayAndTime, defaultTime } from '../../../../shared/presentation/date-time-input';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { ClinicalHistoryFacade } from '../../application/services/clinical-history.facade';
import {
  CLINICAL_INTERVENTION_TYPES, DOSE_MAX_LENGTH, FIELD_EVENT_TYPES, isClinicalType, OBSERVATION_MAX_LENGTH,
  type OperationType, PRODUCT_MAX_LENGTH,
} from '../../domain/model/livestock-operation.model';
import { MONITORING_DIALOG_STYLES } from './monitoring-dialog';

/** Which registration the dialog makes: a field event by the manager, or a clinical intervention by a veterinarian. */
export interface RecordOperationData {
  readonly kind: 'field' | 'clinical';
  readonly animal: MonitoredCattleSummary;
}

/** Registers one field event or clinical intervention for an animal; a future moment is refused before the API is asked. */
@Component({
  selector: 'ichu-record-operation-dialog',
  imports: [ApiErrorMessagePipe, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ titleKey | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ leadKey | translate: { earTag: data.animal.earTag } }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'health.fields.type' | translate }}</mat-label>
            <mat-select formControlName="type">
              @for (type of types; track type) {
                <mat-option [value]="type">{{ ('health.type.' + type) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'health.fields.day' | translate }}</mat-label>
            <input matInput [matDatepicker]="dayPicker" formControlName="day" [max]="today" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
            <mat-datepicker #dayPicker />
            @if (form.controls.day.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else if (form.controls.day.hasError('matDatepickerMax')) {
              <mat-error>{{ 'health.validation.future' | translate }}</mat-error>
            } @else {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'health.fields.time' | translate }}</mat-label>
            <input matInput type="time" formControlName="time">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          @if (isClinical) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'health.fields.product' | translate }}</mat-label>
              <input matInput formControlName="product" autocomplete="off" [maxlength]="productMax">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'health.fields.dose' | translate }}</mat-label>
              <input matInput formControlName="dose" autocomplete="off" [maxlength]="doseMax">
            </mat-form-field>
          }
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'health.fields.observation' | translate }}</mat-label>
            <textarea matInput formControlName="observation" rows="3" [maxlength]="observationMax"></textarea>
          </mat-form-field>
        </div>
        @if (futureError()) {
          <p class="form-error" role="alert">{{ 'health.validation.future' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : submitKey) | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: MONITORING_DIALOG_STYLES,
})
export class RecordOperationDialog {
  readonly data = inject<RecordOperationData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RecordOperationDialog, 'saved'>>(MatDialogRef);
  private readonly facade = inject(ClinicalHistoryFacade);
  readonly isClinical = this.data.kind === 'clinical';
  readonly types: readonly OperationType[] = this.isClinical ? CLINICAL_INTERVENTION_TYPES : FIELD_EVENT_TYPES;
  readonly titleKey = this.isClinical ? 'health.records.clinicalTitle' : 'health.records.fieldTitle';
  readonly leadKey = this.isClinical ? 'health.records.clinicalLead' : 'health.records.fieldLead';
  readonly submitKey = this.isClinical ? 'health.records.clinicalSubmit' : 'health.records.fieldSubmit';
  readonly productMax = PRODUCT_MAX_LENGTH;
  readonly doseMax = DOSE_MAX_LENGTH;
  readonly observationMax = OBSERVATION_MAX_LENGTH;
  readonly today = new Date();
  readonly saving = signal(false);
  readonly futureError = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    type: new FormControl<OperationType | null>(null, Validators.required),
    day: new FormControl<Date | null>(new Date(), Validators.required),
    time: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
    product: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(PRODUCT_MAX_LENGTH)] }),
    dose: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(DOSE_MAX_LENGTH)] }),
    observation: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(OBSERVATION_MAX_LENGTH)] }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { type, day, time, product, dose, observation } = this.form.getRawValue();
    const occurred = combineDayAndTime(day, time);
    if (this.form.invalid || !type || !occurred || this.saving()) return;
    this.futureError.set(occurred.getTime() > Date.now());
    if (this.futureError()) return;
    const common = {
      cattleId: this.data.animal.cattleId,
      occurredAt: occurred.toISOString(),
      observation: observation.trim() || null,
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (isClinicalType(type)) {
        await this.facade.registerClinicalIntervention({
          ...common, type, product: product.trim() || null, dose: dose.trim() || null,
        });
      } else {
        await this.facade.registerFieldEvent({ ...common, type });
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
