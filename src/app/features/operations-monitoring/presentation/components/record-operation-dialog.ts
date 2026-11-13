import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { LivestockOperationRecorder } from '../../application/services/livestock-operation-recorder';
import {
  BREEDING_SERVICE_TYPES, calendarDay, DOSE_MAX_LENGTH, expectedCalvingDateProblem, isClinicalType, OBSERVATION_MAX_LENGTH,
  type OperationRecordInput, type OperationType, PREGNANCY_RESULTS, type PregnancyResult, PRODUCT_MAX_LENGTH,
  type ReproductiveFacts, SIRE_REFERENCE_MAX_LENGTH,
} from '../../domain/model/livestock-operation.model';
import { MONITORING_DIALOG_STYLES } from './monitoring-dialog';

/** The translation keys of a dialog's title, lead and submit button, so each screen names its own kind of record. */
export interface RecordOperationCopy {
  readonly titleKey: string;
  readonly leadKey: string;
  readonly submitKey: string;
}

/** The animal, the types the account may choose from (already limited to what it may register), and the copy of the screen. */
export interface RecordOperationData {
  readonly ranchId: string;
  readonly animal: MonitoredCattleSummary;
  readonly types: readonly OperationType[];
  readonly copy: RecordOperationCopy;
}

/** Registers one record for an animal; the fields follow the chosen type, and a future moment or a calving date the API would refuse is caught first. */
@Component({
  selector: 'ichu-record-operation-dialog',
  imports: [
    ApiErrorMessagePipe, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    ReactiveFormsModule, TranslatePipe,
  ],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ data.copy.titleKey | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ data.copy.leadKey | translate: { earTag: data.animal.earTag } }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'health.fields.type' | translate }}</mat-label>
            <mat-select formControlName="type">
              @for (type of data.types; track type) {
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
          @if (isBreedingService()) {
            <mat-form-field appearance="outline" class="span-two">
              <mat-label>{{ 'health.fields.sireReference' | translate }}</mat-label>
              <input matInput formControlName="sireReference" autocomplete="off" [maxlength]="sireMax">
            </mat-form-field>
          }
          @if (isDiagnosis()) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'health.fields.pregnancyResult' | translate }}</mat-label>
              <mat-select formControlName="pregnancyResult">
                @for (result of pregnancyResults; track result) {
                  <mat-option [value]="result">{{ ('reproduction.pregnancyResult.' + result) | translate }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
          }
          @if (isPregnantDiagnosis()) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'health.fields.expectedCalvingDate' | translate }}</mat-label>
              <input matInput [matDatepicker]="calvingPicker" formControlName="expectedCalvingDate" autocomplete="off">
              <mat-datepicker-toggle matIconSuffix [for]="calvingPicker" />
              <mat-datepicker #calvingPicker />
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            </mat-form-field>
          }
          @if (isClinical()) {
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
        @if (calvingError(); as key) {
          <p class="form-error" role="alert">{{ key | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : data.copy.submitKey) | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styles: MONITORING_DIALOG_STYLES,
})
export class RecordOperationDialog {
  readonly data = inject<RecordOperationData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RecordOperationDialog, 'saved'>>(MatDialogRef);
  private readonly recorder = inject(LivestockOperationRecorder);
  readonly productMax = PRODUCT_MAX_LENGTH;
  readonly doseMax = DOSE_MAX_LENGTH;
  readonly observationMax = OBSERVATION_MAX_LENGTH;
  readonly sireMax = SIRE_REFERENCE_MAX_LENGTH;
  readonly pregnancyResults = PREGNANCY_RESULTS;
  readonly today = new Date();
  readonly saving = signal(false);
  readonly futureError = signal(false);
  readonly calvingError = signal<string | null>(null);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    type: new FormControl<OperationType | null>(this.data.types[0] ?? null, Validators.required),
    day: new FormControl<Date | null>(new Date(), Validators.required),
    time: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
    product: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(PRODUCT_MAX_LENGTH)] }),
    dose: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(DOSE_MAX_LENGTH)] }),
    sireReference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(SIRE_REFERENCE_MAX_LENGTH)] }),
    pregnancyResult: new FormControl<PregnancyResult | null>(null),
    expectedCalvingDate: new FormControl<Date | null>(null),
    observation: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(OBSERVATION_MAX_LENGTH)] }),
  });
  private readonly selectedType = toSignal(this.form.controls.type.valueChanges, { initialValue: this.form.controls.type.value });
  private readonly selectedResult = toSignal(this.form.controls.pregnancyResult.valueChanges, { initialValue: null });
  readonly isClinical = computed(() => {
    const type = this.selectedType();
    return type !== null && isClinicalType(type);
  });
  readonly isBreedingService = computed(() => {
    const type = this.selectedType();
    return type !== null && BREEDING_SERVICE_TYPES.includes(type);
  });
  readonly isDiagnosis = computed(() => this.selectedType() === 'PregnancyDiagnosis');
  readonly isPregnantDiagnosis = computed(() => this.isDiagnosis() && this.selectedResult() === 'Pregnant');

  constructor() {
    this.applyResultRule(this.form.controls.type.value);
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(type => this.applyResultRule(type));
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { type, day, time, product, dose, sireReference, pregnancyResult, expectedCalvingDate, observation } = this.form.getRawValue();
    const occurred = combineDayAndTime(day, time);
    if (this.form.invalid || !type || !occurred || this.saving()) return;
    this.futureError.set(occurred.getTime() > Date.now());
    this.calvingError.set(null);
    if (this.futureError()) return;

    const facts = this.reproductiveFacts(type, occurred, sireReference, pregnancyResult, expectedCalvingDate);
    if (facts === 'calvingOutOfRange') return;
    const common = {
      cattleId: this.data.animal.cattleId,
      occurredAt: occurred.toISOString(),
      observation: observation.trim() || null,
      ...facts,
    };
    const record: OperationRecordInput = isClinicalType(type)
      ? { ...common, type, product: product.trim() || null, dose: dose.trim() || null }
      : { ...common, type };

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.recorder.register(this.data.ranchId, record);
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** A pregnancy result needs a value only for a diagnosis, so the other types leave it unvalidated. */
  private applyResultRule(type: OperationType | null): void {
    const control = this.form.controls.pregnancyResult;
    control.setValidators(type === 'PregnancyDiagnosis' ? [Validators.required] : []);
    control.updateValueAndValidity();
  }

  /** Builds the reproductive facts of the type; a calving date outside the API window is reported here and returns the marker. */
  private reproductiveFacts(
    type: OperationType,
    occurred: Date,
    sireReference: string,
    pregnancyResult: PregnancyResult | null,
    expectedCalvingDate: Date | null,
  ): ReproductiveFacts | 'calvingOutOfRange' {
    if (BREEDING_SERVICE_TYPES.includes(type)) return { sireReference: sireReference.trim() || null };
    if (type !== 'PregnancyDiagnosis') return {};
    const calving = pregnancyResult === 'Pregnant' && expectedCalvingDate ? calendarDay(expectedCalvingDate) : null;
    if (calving) {
      const problem = expectedCalvingDateProblem(occurred.toISOString().slice(0, 10), calving);
      if (problem) {
        this.calvingError.set(problem === 'tooFar' ? 'reproduction.validation.calvingTooFar' : 'reproduction.validation.calvingNotAfterDiagnosis');
        return 'calvingOutOfRange';
      }
    }
    return { pregnancyResult, expectedCalvingDate: calving };
  }
}
