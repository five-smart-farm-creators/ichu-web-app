import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import type { AccessScope, DecideHerdAdvisory, HerdAdvisoryRecord } from '../../domain/model/herd-advisory.model';

export interface HerdAdvisoryDecisionData {
  readonly advisory: HerdAdvisoryRecord;
}

/** Collects the scope and last valid day for a grant, or rejects; closes with the decision or nothing. */
@Component({
  selector: 'ichu-herd-advisory-decision-dialog',
  imports: [
    LocalizedDatePipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [provideLocalizedDateAdapter()],
  templateUrl: './herd-advisory-decision-dialog.html',
  styleUrl: './herd-advisory-decision-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HerdAdvisoryDecisionDialog {
  readonly advisory = inject<HerdAdvisoryDecisionData>(MAT_DIALOG_DATA).advisory;
  private readonly dialogRef: MatDialogRef<HerdAdvisoryDecisionDialog, DecideHerdAdvisory | undefined> = inject(MatDialogRef);
  readonly minimumExpiry = tomorrow();
  readonly form = new FormGroup({
    scope: new FormControl<AccessScope>('Read', { nonNullable: true, validators: [Validators.required] }),
    expiresOn: new FormControl<Date | null>(null, { validators: [Validators.required] }),
  });

  /** Grants access through the end of the chosen local day, so the picked date is the last valid day. */
  grant(): void {
    this.form.markAllAsTouched();
    const expiresOn = this.form.controls.expiresOn.value;
    if (this.form.invalid || !expiresOn) return;
    this.dialogRef.close({
      decision: 'grant',
      scope: this.form.controls.scope.value,
      expiresAt: endOfDay(expiresOn).toISOString(),
    });
  }

  reject(): void {
    this.dialogRef.close({ decision: 'reject' });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}

/** Expiry must be in the future, so the earliest selectable day is tomorrow. */
function tomorrow(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

function endOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}
