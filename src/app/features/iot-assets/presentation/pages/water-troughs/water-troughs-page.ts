import { DecimalPipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { WaterTroughsFacade } from '../../../application/services/water-troughs.facade';
import type { WaterTrough } from '../../../domain/model/water-trough.model';
import { IOT_DIALOG_CONFIG, type IotDialogOutcome } from '../../components/iot-dialog';
import { RegisterWaterTroughDialog } from '../../components/register-water-trough-dialog';
import { WaterTroughHistoryDialog } from '../../components/water-trough-history-dialog';
import { WaterTroughRangeDialog } from '../../components/water-trough-range-dialog';
import { IOT_ERROR_KEYS } from '../../iot-error-keys';
import { slicePage } from '../../slice-page';

/** Lists the ranch's water troughs with their lot, band, controller and latest temperature; a managing account registers them and sets bands. */
@Component({
  selector: 'ichu-water-troughs-page',
  imports: [
    ApiErrorMessagePipe, DecimalPipe, ExportMenu, Icon, LocalizedDatePipe, MatPaginatorModule, MatProgressBarModule, MatTableModule,
    TranslatePipe,
  ],
  providers: [WaterTroughsFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './water-troughs-page.html',
  styleUrl: './water-troughs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaterTroughsPage {
  readonly facade = inject(WaterTroughsFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly displayedColumns = ['name', 'lot', 'range', 'temperature', 'rangeStatus', 'controller', 'heater', 'actions'];
  readonly pageSizeOptions = [10, 25];
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly pagedTroughs = computed(() => slicePage(this.facade.troughs(), this.pageIndex(), this.pageSize()));
  readonly notice = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.pageIndex.set(0);
        this.notice.set(null);
        this.conflict.set(false);
        void this.facade.open(ranchId);
      });
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  openRegister(): void {
    this.dialog.open(RegisterWaterTroughDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'waterTroughs.register.saved'));
  }

  openRange(trough: WaterTrough): void {
    this.dialog.open(WaterTroughRangeDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: trough })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'waterTroughs.range.saved'));
  }

  /** Charts the last 24 hours of the trough's controller; only a trough with a controller offers this. */
  openHistory(trough: WaterTrough, controllerId: string): void {
    this.dialog.open(WaterTroughHistoryDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: { trough, controllerId } });
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    this.notice.set(null);
    try {
      const troughs = this.facade.troughs();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-water-troughs', columns, troughs);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.waterTroughs');
        await this.exportService.exportPdf('ichu-water-troughs', title, columns, troughs, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  /** A conflict has already reloaded the troughs, so the page says so instead of reporting a save. */
  private showOutcome(outcome: IotDialogOutcome | undefined, savedKey: string): void {
    this.notice.set(outcome === 'saved' ? savedKey : null);
    this.conflict.set(outcome === 'conflict');
  }

  private exportColumns(): ExportColumn<WaterTrough>[] {
    const text = (key: string): string => this.translate.instant(key);
    const statusOf = (trough: WaterTrough) => this.facade.statusOf(trough.id);
    return [
      { header: text('waterTroughs.fields.name'), value: trough => trough.name },
      { header: text('waterTroughs.fields.lot'), value: trough => this.facade.lotName(trough.lotId) },
      { header: text('waterTroughs.fields.minimum'), value: trough => trough.temperatureRange?.minimumCelsius ?? null },
      { header: text('waterTroughs.fields.maximum'), value: trough => trough.temperatureRange?.maximumCelsius ?? null },
      {
        header: text('waterTroughs.status.fields.waterTemperature') + ' (' + text('monitoring.units.celsius') + ')',
        value: trough => {
          const status = statusOf(trough);
          if (!status) return null;
          return status.latestReading?.temperature ?? text('waterTroughs.status.measurement.' + status.measurementStatus);
        },
      },
      { header: text('waterTroughs.status.fields.capturedAt'), value: trough => toDate(statusOf(trough)?.latestReading?.capturedAt) },
      {
        header: text('waterTroughs.status.fields.rangeStatus'),
        value: trough => {
          const status = statusOf(trough);
          return status ? text('waterTroughs.status.range.' + status.rangeStatus) : null;
        },
      },
      {
        header: text('waterTroughs.status.fields.controller'),
        value: trough => {
          const status = statusOf(trough);
          return status ? text('waterTroughs.status.controller.' + status.controllerStatus) : null;
        },
      },
      {
        header: text('waterTroughs.status.fields.lastCommunication'),
        value: trough => toDate(statusOf(trough)?.lastCommunicationAt),
      },
      {
        header: text('waterTroughs.status.fields.heater'),
        value: trough => {
          const reading = statusOf(trough)?.latestReading;
          return reading ? text('waterTroughs.status.heater.' + reading.heaterState) : null;
        },
      },
    ];
  }
}

/** A timestamp as a Date for Excel and PDF; a missing timestamp stays empty. */
function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
