import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TERMS_VERSION } from '../../../../core/layout/terms';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { PlansFacade } from '../../application/services/plans.facade';
import { SubscriptionFacade } from '../../application/services/subscription.facade';
import { PriceBreakdown } from './price-breakdown';

/** The plan the visitor chose and the acquisition source that the link carried. */
export interface SubscribeDialogData {
  readonly planId: string;
  readonly acquisitionSource: string;
}

/** Confirms the quoted amounts and the terms, then sends the ranch manager to the hosted payment page. */
@Component({
  selector: 'ichu-subscribe-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, PriceBreakdown, ReactiveFormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'subscriptions.confirm.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="dialog-lead">{{ 'subscriptions.confirm.lead' | translate }}</p>
        @if (quote(); as quoted) {
          <ichu-price-breakdown [priced]="quoted" [planTier]="plan()?.tier ?? null" />
          <label class="check-row">
            <input type="checkbox" formControlName="acceptTerms">
            <span>{{ 'subscriptions.confirm.acceptTerms' | translate: { version: termsVersion } }}</span>
          </label>
          @if (form.controls.acceptTerms.touched && form.controls.acceptTerms.invalid) {
            <p class="form-error" role="alert">{{ 'subscriptions.confirm.termsRequired' | translate }}</p>
          }
          <p class="dialog-link">
            <a routerLink="/terms" target="_blank" rel="noopener">{{ 'subscriptions.confirm.readTerms' | translate }}</a>
          </p>
        } @else if (quoteError(); as error) {
          <p class="form-error" role="alert">{{ error | apiErrorMessage }}</p>
        } @else {
          <p class="text-muted" role="status">{{ 'plans.calculating' | translate }}</p>
        }
        @if (facade.error(); as error) {
          <p class="form-error" role="alert">{{ error | apiErrorMessage }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button type="submit" class="btn primary" [disabled]="!quote() || facade.busy() || redirecting()">
          {{ (facade.busy() || redirecting() ? 'subscriptions.confirm.redirecting' : 'subscriptions.confirm.submit') | translate }}
        </button>
      </mat-dialog-actions>
    </form>`,
  styleUrl: '../styles/subscription-pages.scss',
})
export class SubscribeDialog {
  private readonly data = inject<SubscribeDialogData>(MAT_DIALOG_DATA);
  private readonly plans = inject(PlansFacade);
  readonly facade = inject(SubscriptionFacade);
  /** Reused by every retry of this dialog, so a repeated submit cannot create a second subscription. */
  private readonly operationId = crypto.randomUUID();
  readonly termsVersion = TERMS_VERSION;
  readonly plan = computed(() => this.plans.plans().find(candidate => candidate.id === this.data.planId) ?? null);
  readonly quote = computed(() => this.plans.quotes().get(this.data.planId) ?? null);
  readonly quoteError = computed(() => this.plans.quoteErrors().get(this.data.planId) ?? null);
  readonly redirecting = signal(false);
  readonly form = new FormGroup({
    acceptTerms: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  /** Sends the quoted total as the expected total; a 409 or 422 means the quote moved, so the prices are requested again. */
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const quote = this.quote();
    if (this.form.invalid || !quote || this.facade.busy() || this.redirecting()) return;
    const started = await this.facade.requestAndPay({
      planId: quote.planId,
      headCount: quote.headCount,
      expectedTotal: quote.total.amount,
      operationId: this.operationId,
      acquisitionSource: this.data.acquisitionSource,
    });
    if (started) {
      this.redirecting.set(true);
      return;
    }
    const status = this.facade.error()?.status;
    if (status === 409 || status === 422) void this.plans.refreshQuotes();
  }
}
