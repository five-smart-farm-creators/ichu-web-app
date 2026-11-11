import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { ApiError, toApiError } from '../../../../../shared/infrastructure/http/api-error';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { DeviceInventoryFacade } from '../../../application/services/device-inventory.facade';
import {
  COMMUNICATION_STATUSES, type CommunicationStatus, type Device, DEVICE_STATUSES, type DeviceStatus, DEVICE_TYPES, type DeviceType,
} from '../../../domain/model/device.model';
import { VERSION_CONFLICT } from '../../../domain/model/version-conflict';
import { AssignDeviceDialog } from '../../components/assign-device-dialog';
import { DeviceHistoryDialog } from '../../components/device-history-dialog';
import { IOT_DIALOG_CONFIG, type IotDialogOutcome } from '../../components/iot-dialog';
import { RegisterDeviceDialog } from '../../components/register-device-dialog';
import { ReleaseDeviceDialog } from '../../components/release-device-dialog';
import { IOT_ERROR_KEYS } from '../../iot-error-keys';
import { relativeTime } from '../../relative-time';
import { slicePage } from '../../slice-page';

/** Lists the ranch's IoT devices with filters, paging, registration, and actions; write actions need a managing account. */
@Component({
  selector: 'ichu-devices-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    MatFormFieldModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [DeviceInventoryFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './devices-page.html',
  styleUrl: './devices-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicesPage {
  readonly facade = inject(DeviceInventoryFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly types = DEVICE_TYPES;
  readonly statuses = DEVICE_STATUSES;
  readonly communications = COMMUNICATION_STATUSES;
  readonly displayedColumns = ['serial', 'type', 'status', 'communication', 'battery', 'firmware', 'assignedTo', 'actions'];
  readonly pageSizeOptions = [10, 25, 50];
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly filtersApplied = computed(() => Object.keys(this.facade.filter()).length > 0);
  readonly pagedDevices = computed(() => slicePage(this.facade.visibleDevices(), this.pageIndex(), this.pageSize()));
  readonly filterForm = new FormGroup({
    type: new FormControl<DeviceType | ''>('', { nonNullable: true }),
    status: new FormControl<DeviceStatus | ''>('', { nonNullable: true }),
    communication: new FormControl<CommunicationStatus | ''>('', { nonNullable: true }),
  });
  readonly busyDeviceId = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<ApiError | null>(null);
  readonly conflict = signal(false);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.filterForm.reset({ type: '', status: '', communication: '' });
        this.pageIndex.set(0);
        this.notice.set(null);
        this.actionError.set(null);
        this.conflict.set(false);
        void this.facade.open(ranchId);
      });
    });
  }

  applyFilters(): void {
    const { type, status, communication } = this.filterForm.getRawValue();
    this.pageIndex.set(0);
    this.facade.setFilter({
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(communication ? { communication } : {}),
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ type: '', status: '', communication: '' });
    this.applyFilters();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  openRegister(): void {
    this.dialog.open(RegisterDeviceDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'devices.register.saved'));
  }

  openAssign(device: Device): void {
    this.dialog.open(AssignDeviceDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: device })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'devices.assign.saved'));
  }

  openRelease(device: Device): void {
    this.dialog.open(ReleaseDeviceDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: device })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'devices.release.saved'));
  }

  openHistory(device: Device): void {
    this.dialog.open(DeviceHistoryDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: device });
  }

  toggleMaintenance(device: Device): void {
    const inMaintenance = device.status !== 'Maintenance';
    void this.run(
      device.id,
      () => this.facade.setMaintenance(device.id, inMaintenance),
      inMaintenance ? 'devices.maintenance.on' : 'devices.maintenance.off',
    );
  }

  /** Relative time of the last report; it is recomputed on render, so it updates on the next change, not by timer. */
  lastSeen(device: Device): string | null {
    return device.lastCommunicationAt
      ? relativeTime(new Date(device.lastCommunicationAt), new Date(), this.dateLocale())
      : null;
  }

  /** Names what the device serves, such as "Animal: 101"; empty while the device is free. */
  assignedText(device: Device): string {
    const assignment = device.currentAssignment;
    if (!assignment) return '';
    const label = this.facade.targetLabel(assignment) ?? this.translate.instant('devices.unknownTarget');
    return this.translate.instant('devices.targetType.' + assignment.targetType) + ': ' + label;
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    this.notice.set(null);
    try {
      const devices = this.facade.visibleDevices();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-devices', columns, devices);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.iotDevices');
        await this.exportService.exportPdf('ichu-devices', title, columns, devices, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private async run(deviceId: string, operation: () => Promise<void>, savedKey: string): Promise<void> {
    this.busyDeviceId.set(deviceId);
    this.notice.set(null);
    this.actionError.set(null);
    this.conflict.set(false);
    try {
      await operation();
      this.notice.set(savedKey);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === VERSION_CONFLICT) {
        this.conflict.set(true);
      } else {
        this.actionError.set(apiError);
      }
    } finally {
      this.busyDeviceId.set(null);
    }
  }

  /** A conflict has already reloaded the devices, so the page says so instead of reporting a save. */
  private showOutcome(outcome: IotDialogOutcome | undefined, savedKey: string): void {
    this.notice.set(outcome === 'saved' ? savedKey : null);
    this.actionError.set(null);
    this.conflict.set(outcome === 'conflict');
  }

  private exportColumns(): ExportColumn<Device>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('devices.fields.serial'), value: device => device.serial },
      { header: text('devices.fields.type'), value: device => text('devices.type.' + device.type) },
      { header: text('devices.fields.status'), value: device => text('devices.status.' + device.status) },
      {
        header: text('devices.fields.communication'),
        value: device => text('devices.communication.' + device.communicationStatus),
      },
      {
        header: text('devices.fields.lastSeen'),
        value: device => (device.lastCommunicationAt ? new Date(device.lastCommunicationAt) : null),
      },
      { header: text('devices.fields.battery'), value: device => device.batteryPercentage },
      { header: text('devices.fields.firmware'), value: device => device.firmwareVersion },
      { header: text('devices.fields.assignedTo'), value: device => this.assignedText(device) },
    ];
  }
}
