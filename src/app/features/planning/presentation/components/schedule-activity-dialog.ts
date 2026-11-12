import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { combineDayAndTime, defaultTime } from '../../../../shared/presentation/date-time-input';
import { PlannedActivityFacade } from '../../application/services/planned-activity.facade';
import { type PlanningDialogOutcome } from './planning-dialog';

export interface ScheduleActivityData {
  readonly ranchId: string;
  readonly campaignId: string | null;
}

/** Schedules work for the whole ranch or one active animal, optionally inside a campaign. */
@Component({
  selector: 'ichu-schedule-activity-dialog',
  imports: [ApiErrorMessagePipe, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  providers: [PlannedActivityFacade, provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'planning.activities.schedule.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'planning.activities.schedule.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.title' | translate }}</mat-label>
            <input matInput formControlName="title" autocomplete="off">
            <mat-error>{{ 'planning.validation.titleRequired' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.animal' | translate }}</mat-label>
            <mat-select formControlName="cattleId">
              <mat-option value="">{{ 'planning.calendar.ranchWide' | translate }}</mat-option>
              @for (animal of animals(); track animal.cattleId) {
                <mat-option [value]="animal.cattleId">{{ animal.earTag }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.day' | translate }}</mat-label>
            <input matInput [matDatepicker]="dayPicker" formControlName="day" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
            <mat-datepicker #dayPicker />
            @if (form.controls.day.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.time' | translate }}</mat-label>
            <input matInput type="time" formControlName="time">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
        </div>
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'planning.activities.schedule.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/planning-dialog.scss',
})
export class ScheduleActivityDialog {
  private readonly dialogRef = inject<MatDialogRef<ScheduleActivityDialog, PlanningDialogOutcome>>(MatDialogRef);
  private readonly data = inject<ScheduleActivityData>(MAT_DIALOG_DATA);
  private readonly facade = inject(PlannedActivityFacade);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    cattleId: new FormControl('', { nonNullable: true }),
    day: new FormControl<Date | null>(new Date(), Validators.required),
    time: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    void this.cattleContext.monitoredCattle(this.data.ranchId, { activeOnly: true }, Number.POSITIVE_INFINITY)
      .then(animals => this.animals.set(animals))
      .catch(error => this.error.set(toApiError(error)));
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { title, cattleId, day, time } = this.form.getRawValue();
    const scheduled = combineDayAndTime(day, time);
    if (this.form.invalid || !scheduled || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.schedule(this.data.ranchId, {
        campaignId: this.data.campaignId,
        cattleId: cattleId || null,
        title: title.trim(),
        scheduledAt: scheduled.toISOString(),
      });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
