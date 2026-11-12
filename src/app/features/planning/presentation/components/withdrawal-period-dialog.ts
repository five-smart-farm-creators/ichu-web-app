import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import {
  type ClinicalInterventionSummary, OperationsMonitoringContextFacade,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { combineDayAndTime, defaultTime } from '../../../../shared/presentation/date-time-input';
import { WithdrawalPeriodsFacade } from '../../application/services/withdrawal-periods.facade';
import { isValidWithdrawalRange } from '../../domain/model/withdrawal-period.model';
import { type PlanningDialogOutcome } from './planning-dialog';

export interface WithdrawalPeriodDialogData {
  readonly ranchId: string;
}

/** Records the period an interval of withdrawal lasts; the caller gives both bounds, because Planning never calculates them. */
@Component({
  selector: 'ichu-withdrawal-period-dialog',
  imports: [
    ApiErrorMessagePipe,
    LocalizedDatePipe,
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
  template: `<h2 mat-dialog-title>{{ 'planning.withdrawal.record.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'planning.withdrawal.record.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.animal' | translate }}</mat-label>
            <mat-select formControlName="cattleId" (selectionChange)="chooseAnimal($event.value)">
              @for (animal of activeAnimals(); track animal.cattleId) {
                <mat-option [value]="animal.cattleId">{{ animal.earTag }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.withdrawal.startsDay' | translate }}</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startsDay" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
            <mat-datepicker #startPicker />
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.time' | translate }}</mat-label>
            <input matInput type="time" formControlName="startsTime">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.withdrawal.endsDay' | translate }}</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="endsDay" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="endPicker" />
            <mat-datepicker #endPicker />
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.time' | translate }}</mat-label>
            <input matInput type="time" formControlName="endsTime">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.linkedIntervention' | translate }}</mat-label>
            <mat-select formControlName="interventionId">
              <mat-option value="">{{ 'planning.activities.noIntervention' | translate }}</mat-option>
              @for (intervention of interventions(); track intervention.interventionId) {
                <mat-option [value]="intervention.interventionId">
                  {{ ('health.type.' + intervention.type) | translate }} · {{ intervention.occurredAt | localizedDate: 'mediumDate' }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        @if (rangeError()) {
          <p class="form-error" role="alert">{{ 'planning.validation.withdrawalRangeOrder' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'planning.withdrawal.record.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/planning-dialog.scss',
})
export class WithdrawalPeriodDialog {
  private readonly dialogRef = inject<MatDialogRef<WithdrawalPeriodDialog, PlanningDialogOutcome>>(MatDialogRef);
  private readonly data = inject<WithdrawalPeriodDialogData>(MAT_DIALOG_DATA);
  private readonly facade = inject(WithdrawalPeriodsFacade);
  private readonly operations = inject(OperationsMonitoringContextFacade);
  readonly activeAnimals = computed(() => this.facade.animals().filter(animal => animal.status === 'Active'));
  readonly interventions = signal<readonly ClinicalInterventionSummary[]>([]);
  readonly saving = signal(false);
  readonly rangeError = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    cattleId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    interventionId: new FormControl('', { nonNullable: true }),
    startsDay: new FormControl<Date | null>(new Date(), Validators.required),
    startsTime: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
    endsDay: new FormControl<Date | null>(new Date(), Validators.required),
    endsTime: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
  });

  /** A link can only name an intervention of the same animal, so the choices follow the animal. */
  chooseAnimal(cattleId: string): void {
    this.form.controls.interventionId.setValue('');
    this.interventions.set([]);
    if (!cattleId) return;
    void this.operations.interventionsFor(this.data.ranchId, cattleId)
      .then(interventions => this.interventions.set(interventions))
      .catch(error => this.error.set(toApiError(error)));
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { cattleId, interventionId, startsDay, startsTime, endsDay, endsTime } = this.form.getRawValue();
    const startsAt = combineDayAndTime(startsDay, startsTime);
    const endsAt = combineDayAndTime(endsDay, endsTime);
    if (this.form.invalid || !startsAt || !endsAt || this.saving()) return;
    this.rangeError.set(!isValidWithdrawalRange(startsAt, endsAt));
    if (this.rangeError()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.record({
        cattleId,
        interventionId: interventionId || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
