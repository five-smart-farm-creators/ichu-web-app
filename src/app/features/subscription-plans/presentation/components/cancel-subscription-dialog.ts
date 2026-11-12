import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { SubscriptionFacade } from '../../application/services/subscription.facade';
import { MAX_CANCELLATION_REASON_LENGTH } from '../../domain/model/subscription.model';

/** Asks for the reason before a subscription stops; the reason is required because each cancellation is followed up. */
@Component({
  selector: 'ichu-cancel-subscription-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'subscriptions.cancel.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'subscriptions.cancel.lead' | translate }}</p>
        <mat-form-field appearance="outline" class="dialog-field">
          <mat-label>{{ 'subscriptions.cancel.reason' | translate }}</mat-label>
          <textarea matInput formControlName="reason" rows="3" maxlength="200"></textarea>
          <mat-hint align="end">{{ 'subscriptions.cancel.reasonHint' | translate: { max: maxLength } }}</mat-hint>
          <mat-error>{{ 'subscriptions.cancel.reasonRequired' | translate }}</mat-error>
        </mat-form-field>
        @if (facade.error(); as error) {
          <p class="form-error" role="alert">{{ error | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'subscriptions.cancel.keep' | translate }}</button>
        <button type="submit" class="btn danger" [disabled]="facade.busy()">
          {{ (facade.busy() ? 'common.saving' : 'subscriptions.cancel.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/subscription-pages.scss',
})
export class CancelSubscriptionDialog {
  private readonly dialogRef = inject<MatDialogRef<CancelSubscriptionDialog, 'cancelled'>>(MatDialogRef);
  readonly facade = inject(SubscriptionFacade);
  readonly maxLength = MAX_CANCELLATION_REASON_LENGTH;
  readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CANCELLATION_REASON_LENGTH), Validators.pattern(/\S/)],
    }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.facade.busy()) return;
    if (await this.facade.cancel(this.form.getRawValue().reason)) this.dialogRef.close('cancelled');
  }
}
