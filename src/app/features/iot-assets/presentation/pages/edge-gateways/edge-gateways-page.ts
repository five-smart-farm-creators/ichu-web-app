import { DatePipe, formatDate } from '@angular/common';
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
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { EdgeGatewaysFacade } from '../../../application/services/edge-gateways.facade';
import type { EdgeGateway } from '../../../domain/model/edge-gateway.model';
import { IOT_DIALOG_CONFIG, type IotDialogOutcome } from '../../components/iot-dialog';
import { RegisterEdgeGatewayDialog } from '../../components/register-edge-gateway-dialog';
import { RevokeEdgeGatewayDialog } from '../../components/revoke-edge-gateway-dialog';
import { IOT_ERROR_KEYS } from '../../iot-error-keys';
import { slicePage } from '../../slice-page';

/** Lists the ranch's edge gateways; keys appear only in the registration dialog, never in the table or the exports. */
@Component({
  selector: 'ichu-edge-gateways-page',
  imports: [ApiErrorMessagePipe, DatePipe, ExportMenu, Icon, MatPaginatorModule, MatProgressBarModule, MatTableModule, TranslatePipe],
  providers: [EdgeGatewaysFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './edge-gateways-page.html',
  styleUrl: './edge-gateways-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdgeGatewaysPage {
  readonly facade = inject(EdgeGatewaysFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly errorKeys = IOT_ERROR_KEYS;
  readonly displayedColumns = ['name', 'status', 'registeredOn', 'revokedOn', 'actions'];
  readonly pageSizeOptions = [10, 25];
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly pagedGateways = computed(() => slicePage(this.facade.gateways(), this.pageIndex(), this.pageSize()));
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
        void this.facade.open(ranchId);
      });
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  openRegister(): void {
    this.dialog.open(RegisterEdgeGatewayDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'gateways.register.saved'));
  }

  openRevoke(gateway: EdgeGateway): void {
    this.dialog.open(RevokeEdgeGatewayDialog, { ...IOT_DIALOG_CONFIG, injector: this.injector, data: gateway })
      .afterClosed()
      .subscribe(outcome => this.showOutcome(outcome, 'gateways.revoke.saved'));
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    this.notice.set(null);
    try {
      const gateways = this.facade.gateways();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-gateways', columns, gateways);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.edgeGateways');
        await this.exportService.exportPdf('ichu-gateways', title, columns, gateways, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  /** A conflict cannot come from a gateway change, so only the saved notice needs the outcome. */
  private showOutcome(outcome: IotDialogOutcome | undefined, savedKey: string): void {
    this.notice.set(outcome === 'saved' ? savedKey : null);
    this.conflict.set(false);
  }

  private exportColumns(): ExportColumn<EdgeGateway>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('gateways.fields.name'), value: gateway => gateway.name },
      { header: text('gateways.fields.status'), value: gateway => text('gateways.status.' + gateway.status) },
      { header: text('gateways.fields.registeredOn'), value: gateway => new Date(gateway.registeredAt) },
      { header: text('gateways.fields.revokedOn'), value: gateway => (gateway.revokedAt ? new Date(gateway.revokedAt) : null) },
    ];
  }
}
