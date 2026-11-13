import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { EdgeGatewaysFacade } from '../../application/services/edge-gateways.facade';
import type { EdgeGateway } from '../../domain/model/edge-gateway.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES, type IotDialogOutcome } from './iot-dialog';

/** Confirms the revocation of a gateway, which stops its key from authenticating; the action cannot be undone. */
@Component({
  selector: 'ichu-revoke-edge-gateway-dialog',
  imports: [ApiErrorMessagePipe, MatDialogModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'gateways.revoke.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dialog-warning" role="note">{{ 'gateways.revoke.warning' | translate }}</p>
      <p class="device-serial"><strong>{{ 'gateways.fields.name' | translate }}:</strong> {{ gateway.name }}</p>
      @if (error(); as apiError) {
        <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button type="button" class="btn danger" [disabled]="saving()" (click)="revoke()">
        {{ (saving() ? 'common.saving' : 'gateways.revoke.submit') | translate }}
      </button>
    </mat-dialog-actions>`,
  styles: IOT_DIALOG_STYLES,
})
export class RevokeEdgeGatewayDialog {
  private readonly dialogRef = inject<MatDialogRef<RevokeEdgeGatewayDialog, IotDialogOutcome>>(MatDialogRef);
  private readonly facade = inject(EdgeGatewaysFacade);
  readonly gateway = inject<EdgeGateway>(MAT_DIALOG_DATA);
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);

  async revoke(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.facade.revoke(this.gateway.id);
      this.dialogRef.close('saved');
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
