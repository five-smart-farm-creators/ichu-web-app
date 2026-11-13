import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { EdgeGatewaysFacade } from '../../application/services/edge-gateways.facade';
import { type EdgeGatewayRegistration, EDGE_GATEWAY_NAME_MAX_LENGTH } from '../../domain/model/edge-gateway.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

type CopyState = 'gateways.register.copied' | 'gateways.register.copyFailed';

/** Registers a gateway, then shows its key once; the key exists only while this dialog is open. */
@Component({
  selector: 'ichu-register-edge-gateway-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (registration(); as result) {
      <h2 mat-dialog-title>{{ 'gateways.register.keyTitle' | translate }}</h2>
      <mat-dialog-content>
        <p class="dialog-warning" role="note">{{ 'gateways.register.keyWarning' | translate }}</p>
        <p class="device-serial"><strong>{{ 'gateways.fields.name' | translate }}:</strong> {{ result.gateway.name }}</p>
        <code class="key-value">{{ result.key }}</code>
        @if (copyState(); as state) {
          <p class="copy-state" role="status">{{ state | translate }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button type="button" class="btn secondary" (click)="copyKey()">{{ 'gateways.register.copy' | translate }}</button>
        <button type="button" class="btn primary" mat-dialog-close="saved">{{ 'gateways.register.done' | translate }}</button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title>{{ 'gateways.register.title' | translate }}</h2>
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <mat-dialog-content>
          <p class="dialog-lead">{{ 'gateways.register.lead' | translate }}</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'gateways.fields.name' | translate }}</mat-label>
            <input matInput formControlName="name" autocomplete="off" [maxlength]="maxNameLength">
            @if (form.controls.name.hasError('required') || form.controls.name.hasError('pattern')) {
              <mat-error>{{ 'gateways.validation.nameRequired' | translate }}</mat-error>
            }
          </mat-form-field>
          @if (error(); as apiError) {
            <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
          }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
          <button type="submit" class="btn primary" [disabled]="saving()">
            {{ (saving() ? 'common.saving' : 'gateways.register.submit') | translate }}
          </button>
        </mat-dialog-actions>
      </form>
    }`,
  styles: [
    IOT_DIALOG_STYLES,
    '.key-value{display:block;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);font-family:ui-monospace,monospace;font-size:.8125rem;overflow-wrap:anywhere;user-select:all}.copy-state{margin-top:12px;font-size:.8125rem;color:var(--muted)}',
  ],
})
export class RegisterEdgeGatewayDialog {
  private readonly dialogRef = inject<MatDialogRef<RegisterEdgeGatewayDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(EdgeGatewaysFacade);
  readonly maxNameLength = EDGE_GATEWAY_NAME_MAX_LENGTH;
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly registration = signal<EdgeGatewayRegistration | null>(null);
  readonly copyState = signal<CopyState | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(EDGE_GATEWAY_NAME_MAX_LENGTH), Validators.pattern(/\S/)],
    }),
  });

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const { name } = this.form.getRawValue();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.registration.set(await this.facade.register(name));
      // Closing by a stray click would lose the key, which the API never shows again.
      this.dialogRef.disableClose = true;
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }

  async copyKey(): Promise<void> {
    const key = this.registration()?.key;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      this.copyState.set('gateways.register.copied');
    } catch {
      this.copyState.set('gateways.register.copyFailed');
    }
  }
}
