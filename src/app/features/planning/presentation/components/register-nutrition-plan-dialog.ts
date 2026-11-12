import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  type AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { Icon } from '../../../../shared/presentation/icon';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { NutritionFacade } from '../../application/services/nutrition.facade';
import {
  FEED_MAX_LENGTH, isValidPlanValidity, isValidRationQuantity, isValidTargetGain, NUTRITION_NAME_MAX_LENGTH,
  NUTRITION_NOTES_MAX_LENGTH, RATION_KINDS, type RationItem, type RationKind, type RegisterNutritionPlan,
} from '../../domain/model/nutrition-plan.model';
import { localDay } from '../../domain/model/planning-time';
import { type PlanningDialogOutcome } from './planning-dialog';

/** The lot whose ration the dialog registers; the copy names it, while the request carries only its identifier. */
export interface RegisterNutritionPlanData {
  readonly lotName: string;
}

interface RationItemForm {
  readonly feed: FormControl<string>;
  readonly kind: FormControl<RationKind | null>;
  readonly kilograms: FormControl<number | null>;
}

function quantityValidator(control: AbstractControl<number | null>): { quantity: true } | null {
  return isValidRationQuantity(control.value) ? null : { quantity: true };
}

function gainValidator(control: AbstractControl<number | null>): { gain: true } | null {
  return isValidTargetGain(control.value) ? null : { gain: true };
}

function newRationItem(): FormGroup<RationItemForm> {
  return new FormGroup<RationItemForm>({
    feed: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(FEED_MAX_LENGTH)] }),
    kind: new FormControl<RationKind | null>('Forage', Validators.required),
    kilograms: new FormControl<number | null>(null, quantityValidator),
  });
}

/** Registers the ration of a lot from a start day; the checks mirror the API, and an overlap with another plan comes back as its message. */
@Component({
  selector: 'ichu-register-nutrition-plan-dialog',
  imports: [
    ApiErrorMessagePipe, Icon, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    ReactiveFormsModule, TranslatePipe,
  ],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'nutrition.record.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'nutrition.record.lead' | translate: { lot: data.lotName } }}</p>
        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'nutrition.record.name' | translate }}</mat-label>
            <input matInput formControlName="name" autocomplete="off" [maxlength]="nameMax">
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'nutrition.record.validFrom' | translate }}</mat-label>
            <input matInput [matDatepicker]="fromPicker" formControlName="validFrom" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
            <mat-error>{{ 'common.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'nutrition.record.validTo' | translate }}</mat-label>
            <input matInput [matDatepicker]="toPicker" formControlName="validTo" autocomplete="off">
            <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
            <mat-datepicker #toPicker />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'nutrition.record.targetGain' | translate }}</mat-label>
            <input matInput type="number" step="0.1" min="0" formControlName="targetGain">
            <mat-error>{{ 'nutrition.validation.gain' | translate }}</mat-error>
          </mat-form-field>
        </div>

        <section class="ration" [attr.aria-label]="'nutrition.record.itemsTitle' | translate">
          <h3 class="ration-title">{{ 'nutrition.record.itemsTitle' | translate }}</h3>
          <div formArrayName="items" class="ration-list">
            @for (item of items.controls; track $index; let index = $index) {
              <div class="ration-row" [formGroupName]="index">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'nutrition.fields.feed' | translate }}</mat-label>
                  <input matInput formControlName="feed" autocomplete="off" [maxlength]="feedMax">
                  <mat-error>{{ 'common.required' | translate }}</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'nutrition.fields.kind' | translate }}</mat-label>
                  <mat-select formControlName="kind">
                    @for (kind of kinds; track kind) {
                      <mat-option [value]="kind">{{ ('nutrition.kind.' + kind) | translate }}</mat-option>
                    }
                  </mat-select>
                  <mat-error>{{ 'common.required' | translate }}</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'nutrition.fields.kilogramsPerHead' | translate }}</mat-label>
                  <input matInput type="number" step="0.1" min="0" formControlName="kilograms">
                  <mat-error>{{ 'nutrition.validation.quantity' | translate }}</mat-error>
                </mat-form-field>
                <button type="button" class="btn secondary remove-item" (click)="removeItem(index)"
                  [attr.aria-label]="'nutrition.record.removeItem' | translate">
                  <ichu-icon name="close" />
                </button>
              </div>
            }
          </div>
          <button type="button" class="btn secondary" (click)="addItem()">
            <ichu-icon name="plus" />
            <span>{{ 'nutrition.record.addItem' | translate }}</span>
          </button>
        </section>

        <div class="dialog-grid">
          <mat-form-field appearance="outline" class="span-two">
            <mat-label>{{ 'nutrition.record.notes' | translate }}</mat-label>
            <textarea matInput formControlName="notes" rows="2" [maxlength]="notesMax"></textarea>
          </mat-form-field>
        </div>
        @if (problem(); as key) {
          <p class="form-error" role="alert">{{ key | translate }}</p>
        }
        @if (error(); as apiError) {
          <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="saving()">
          {{ (saving() ? 'common.saving' : 'nutrition.record.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/planning-dialog.scss',
})
export class RegisterNutritionPlanDialog {
  readonly data = inject<RegisterNutritionPlanData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RegisterNutritionPlanDialog, PlanningDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(NutritionFacade);
  readonly kinds = RATION_KINDS;
  readonly nameMax = NUTRITION_NAME_MAX_LENGTH;
  readonly notesMax = NUTRITION_NOTES_MAX_LENGTH;
  readonly feedMax = FEED_MAX_LENGTH;
  readonly saving = signal(false);
  readonly problem = signal<string | null>(null);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(NUTRITION_NAME_MAX_LENGTH)] }),
    validFrom: new FormControl<Date | null>(new Date(), Validators.required),
    validTo: new FormControl<Date | null>(null),
    targetGain: new FormControl<number | null>(null, gainValidator),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(NUTRITION_NOTES_MAX_LENGTH)] }),
    items: new FormArray<FormGroup<RationItemForm>>([newRationItem()]),
  });
  readonly items = this.form.controls.items;

  addItem(): void {
    this.items.push(newRationItem());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.problem.set(null);
    if (this.form.invalid || this.saving()) return;
    const { name, validFrom, validTo, targetGain, notes } = this.form.getRawValue();
    const rows = this.items.getRawValue();
    const from = validFrom ? localDay(validFrom) : null;
    const to = validTo ? localDay(validTo) : null;
    if (!from) return;
    if (rows.length === 0) {
      this.problem.set('nutrition.validation.itemsRequired');
      return;
    }
    if (!isValidPlanValidity(from, to)) {
      this.problem.set('nutrition.validation.validityOrder');
      return;
    }
    const ration = rows.flatMap(toRationItem);
    const request: RegisterNutritionPlan = {
      name: name.trim(),
      validFrom: from,
      validTo: to,
      items: ration,
      targetDailyGainKilograms: targetGain,
      notes: notes.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.register(request);
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}

/** A row with a feed, a kind and a quantity becomes an item; an incomplete row is left out, because the form already flags it. */
function toRationItem(row: { readonly feed: string; readonly kind: RationKind | null; readonly kilograms: number | null }): RationItem[] {
  if (!row.kind || row.kilograms === null) return [];
  return [{ feed: row.feed.trim(), kind: row.kind, kilogramsPerHeadPerDay: row.kilograms }];
}
