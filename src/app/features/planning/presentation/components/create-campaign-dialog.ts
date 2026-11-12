import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { PlanningCampaignsFacade } from '../../application/services/planning-campaigns.facade';
import { CAMPAIGN_KINDS, type CampaignKind, isValidCampaignRange } from '../../domain/model/planning-campaign.model';
import { localDay } from '../../domain/model/planning-time';
import { type PlanningDialogOutcome } from './planning-dialog';

/** Creates a sanitary or reproductive campaign over an inclusive range of days; the end day may not precede the start day. */
@Component({
  selector: 'ichu-create-campaign-dialog',
  imports: [ApiErrorMessagePipe, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, TranslatePipe],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'planning.campaigns.create.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'planning.campaigns.create.lead' | translate }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.name' | translate }}</mat-label>
            <input matInput formControlName="name" autocomplete="off">
            <mat-error>{{ 'planning.validation.nameRequired' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'planning.fields.kind' | translate }}</mat-label>
            <mat-select formControlName="kind">
              @for (kind of kinds; track kind) {
                <mat-option [value]="kind">{{ ('planning.kind.' + kind) | translate }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.startsOn' | translate }}</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startsOn" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
            <mat-datepicker #startPicker />
            @if (form.controls.startsOn.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'planning.fields.endsOn' | translate }}</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="endsOn" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="endPicker" />
            <mat-datepicker #endPicker />
            @if (form.controls.endsOn.hasError('matDatepickerParse')) {
              <mat-error>{{ 'common.invalidDate' | translate }}</mat-error>
            } @else {
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            }
          </mat-form-field>
        </div>
        @if (rangeError()) {
          <p class="form-error" role="alert">{{ 'planning.validation.rangeOrder' | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'planning.campaigns.create.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/planning-dialog.scss',
})
export class CreateCampaignDialog {
  private readonly dialogRef = inject<MatDialogRef<CreateCampaignDialog, PlanningDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(PlanningCampaignsFacade);
  readonly kinds = CAMPAIGN_KINDS;
  readonly saving = signal(false);
  readonly rangeError = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    kind: new FormControl<CampaignKind | null>(null, Validators.required),
    startsOn: new FormControl<Date | null>(null, Validators.required),
    endsOn: new FormControl<Date | null>(null, Validators.required),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { name, kind, startsOn, endsOn } = this.form.getRawValue();
    if (this.form.invalid || !kind || !startsOn || !endsOn || this.saving()) return;
    const startDay = localDay(startsOn);
    const endDay = localDay(endsOn);
    this.rangeError.set(!isValidCampaignRange(startDay, endDay));
    if (this.rangeError()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.create({ name: name.trim(), kind, startsOn: startDay, endsOn: endDay });
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
