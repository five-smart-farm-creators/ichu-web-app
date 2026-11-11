import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { dateLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { DeviceInventoryFacade } from '../../application/services/device-inventory.facade';
import type { DeviceAssignment } from '../../domain/model/device-assignment.model';
import type { Device } from '../../domain/model/device.model';
import { IOT_ERROR_KEYS } from '../iot-error-keys';
import { IOT_DIALOG_STYLES } from './iot-dialog';

/** Lists every period a device served, newest first, with the release reason of closed periods. */
@Component({
  selector: 'ichu-device-history-dialog',
  imports: [ApiErrorMessagePipe, DatePipe, MatDialogModule, MatProgressBarModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ 'devices.history.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dialog-lead">{{ 'devices.history.lead' | translate }}</p>
      <p class="device-serial"><strong>{{ 'devices.fields.serial' | translate }}:</strong> {{ device.serial }}</p>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'devices.history.loading' | translate" />
      }
      @if (error(); as apiError) {
        <p class="form-error" role="alert">{{ apiError | apiErrorMessage: errorKeys }}</p>
      } @else if (!loading()) {
        @if (assignments().length === 0) {
          <p class="text-muted">{{ 'devices.history.empty' | translate }}</p>
        } @else {
          <div class="table-scroll">
            <table class="data-table" [attr.aria-label]="'devices.history.title' | translate">
              <thead>
                <tr>
                  <th scope="col">{{ 'devices.fields.target' | translate }}</th>
                  <th scope="col">{{ 'devices.fields.startedAt' | translate }}</th>
                  <th scope="col">{{ 'devices.fields.endedAt' | translate }}</th>
                  <th scope="col">{{ 'devices.fields.releaseReason' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of assignments(); track item.id) {
                  <tr>
                    <td>{{ ('devices.targetType.' + item.targetType) | translate }}: {{ facade.targetLabel(item) ?? ('devices.unknownTarget' | translate) }}</td>
                    <td>{{ item.startedAt | date: 'medium' : undefined : dateLocale }}</td>
                    <td>
                      @if (item.endedAt) {
                        {{ item.endedAt | date: 'medium' : undefined : dateLocale }}
                      } @else {
                        {{ 'devices.history.current' | translate }}
                      }
                    </td>
                    <td>{{ item.releaseReason ?? '' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'devices.history.close' | translate }}</button>
    </mat-dialog-actions>`,
  styles: IOT_DIALOG_STYLES,
})
export class DeviceHistoryDialog {
  readonly facade = inject(DeviceInventoryFacade);
  readonly device = inject<Device>(MAT_DIALOG_DATA);
  readonly dateLocale = dateLocaleTag(inject(LanguageService).current());
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly assignments = signal<readonly DeviceAssignment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const history = await this.facade.assignmentsOf(this.device.id);
      this.assignments.set([...history].sort((first, second) => Date.parse(second.startedAt) - Date.parse(first.startedAt)));
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
