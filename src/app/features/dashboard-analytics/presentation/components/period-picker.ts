import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import {
  type AnalyticsPeriod, addDays, customPeriod, DEFAULT_PERIOD_DAYS, PERIOD_PRESET_DAYS, type PeriodPresetDays, presetPeriod,
} from '../../domain/model/analytics-period';

type PeriodChoice = PeriodPresetDays | 'custom';

/** Chooses a period: a preset of the last days as chips, or a custom range of whole days. Emits only valid periods. */
@Component({
  selector: 'ichu-analytics-period-picker',
  imports: [MatDatepickerModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  providers: [provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="period-chips" role="group" [attr.aria-label]="'analytics.period.label' | translate">
      @for (days of presets; track days) {
        <button type="button" [attr.aria-pressed]="choice() === days" (click)="selectChoice(days)">{{ ('analytics.period.presets.days' + days) | translate }}</button>
      }
      <button type="button" [attr.aria-pressed]="choice() === 'custom'" (click)="selectChoice('custom')">{{ 'analytics.period.custom' | translate }}</button>
    </div>
    @if (choice() === 'custom') {
      <form class="period-form" [formGroup]="form" (ngSubmit)="applyCustom()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-field">
          <mat-label>{{ 'analytics.period.fromDay' | translate }}</mat-label>
          <input matInput [matDatepicker]="fromPicker" formControlName="from" autocomplete="off">
          <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
          <mat-datepicker #fromPicker />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-field">
          <mat-label>{{ 'analytics.period.toDay' | translate }}</mat-label>
          <input matInput [matDatepicker]="toPicker" formControlName="to" autocomplete="off">
          <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
          <mat-datepicker #toPicker />
        </mat-form-field>
        <button type="submit" class="btn primary">{{ 'analytics.period.apply' | translate }}</button>
      </form>
    }
    @if (rangeError()) {
      <p class="form-error" role="alert">{{ 'analytics.period.invalid' | translate }}</p>
    }`,
  styles: `:host{display:flex;flex-direction:column;align-items:flex-start;gap:12px;max-width:100%}
    .period-form{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;width:100%}
    .period-field{flex:1 1 200px;min-width:0}
    .period-form .btn{min-height:44px}`,
})
export class PeriodPicker {
  readonly period = output<AnalyticsPeriod>();
  readonly presets = PERIOD_PRESET_DAYS;
  readonly choice = signal<PeriodChoice>(DEFAULT_PERIOD_DAYS);
  readonly rangeError = signal(false);
  readonly form = new FormGroup({
    from: new FormControl<Date | null>(null),
    to: new FormControl<Date | null>(null),
  });

  selectChoice(choice: PeriodChoice): void {
    // Choosing the active chip again changes nothing, so it must not reload the page.
    if (choice === this.choice()) return;
    this.choice.set(choice);
    this.rangeError.set(false);
    if (choice === 'custom') {
      const today = new Date();
      this.form.setValue({ from: addDays(today, -(DEFAULT_PERIOD_DAYS - 1)), to: today });
      return;
    }
    this.period.emit(presetPeriod(choice, new Date()));
  }

  applyCustom(): void {
    const first = this.form.controls.from.value;
    const last = this.form.controls.to.value;
    const range = first && last ? customPeriod(first, last) : null;
    this.rangeError.set(range === null);
    if (range) this.period.emit(range);
  }
}
