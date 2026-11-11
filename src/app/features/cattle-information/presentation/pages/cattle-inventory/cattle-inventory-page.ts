import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import {
  CattleInventoryFacade, EXPORT_ROW_LIMIT,
} from '../../../application/services/cattle-inventory.facade';
import {
  ageInMonths, type Cattle, CATTLE_STATUSES, type CattleStatus, EAR_TAG_MAX_LENGTH, fromIsoDate, toIsoDate,
} from '../../../domain/model/cattle.model';
import { RegisterCattleDialog } from '../../components/register-cattle-dialog';
import { CATTLE_DIALOG_CONFIG } from '../../components/cattle-dialog';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { CATTLE_ERROR_KEYS } from '../../cattle-error-keys';

/** Lists the ranch's animals with ear tag, status and lot filters, server paging, registration and exports. */
@Component({
  selector: 'ichu-cattle-inventory-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
  ],
  providers: [CattleInventoryFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './cattle-inventory-page.html',
  styleUrl: './cattle-inventory-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CattleInventoryPage {
  readonly errorKeys = CATTLE_ERROR_KEYS;
  readonly facade = inject(CattleInventoryFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly statuses = CATTLE_STATUSES;
  readonly pageSizeOptions = [10, 25, 50];
  readonly displayedColumns = ['earTag', 'breed', 'sex', 'age', 'stage', 'lots', 'status'];
  readonly maxEarTagLength = EAR_TAG_MAX_LENGTH;
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly filtersApplied = computed(() => Object.keys(this.facade.filter()).length > 0);
  /** Server paging knows only the rows it returned, so the length is a lower bound that keeps Next enabled. */
  readonly pageLength = computed(() =>
    this.facade.pageIndex() * this.facade.pageSize() + this.facade.rows().length + (this.facade.hasNextPage() ? 1 : 0));
  readonly filterForm = new FormGroup({
    earTag: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(EAR_TAG_MAX_LENGTH)] }),
    status: new FormControl<CattleStatus | ''>('', { nonNullable: true }),
    lotId: new FormControl('', { nonNullable: true }),
  });
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly notice = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.filterForm.reset({ earTag: '', status: '', lotId: '' });
        this.notice.set(null);
        void this.facade.open(ranchId);
      });
    });
  }

  applyFilters(): void {
    const { earTag, status, lotId } = this.filterForm.getRawValue();
    void this.facade.search({
      ...(earTag.trim() ? { earTag: earTag.trim() } : {}),
      ...(status ? { status } : {}),
      ...(lotId ? { lotId } : {}),
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ earTag: '', status: '', lotId: '' });
    void this.facade.search({});
  }

  onPage(event: PageEvent): void {
    void this.facade.goToPage(event.pageIndex, event.pageSize);
  }

  ageMonths(animal: Cattle): number {
    return ageInMonths(animal.birthDate, toIsoDate(new Date()));
  }

  openRegister(): void {
    this.dialog.open(RegisterCattleDialog, { ...CATTLE_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome === 'saved') this.notice.set('cattle.register.saved');
      });
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    this.notice.set(null);
    try {
      const animals = await this.facade.exportRows();
      const columns = this.exportColumns(toIsoDate(new Date()));
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-cattle', columns, animals);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.animals');
        await this.exportService.exportPdf('ichu-cattle', title, columns, animals, subtitle);
      }
      if (animals.length >= EXPORT_ROW_LIMIT) this.notice.set('cattle.export.limited');
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(today: string): ExportColumn<Cattle>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('cattle.fields.earTag'), value: animal => animal.earTag },
      { header: text('cattle.fields.breed'), value: animal => text('cattle.breed.' + animal.breed) },
      { header: text('cattle.fields.sex'), value: animal => text('cattle.sex.' + animal.sex) },
      { header: text('cattle.fields.birthDate'), value: animal => fromIsoDate(animal.birthDate) },
      { header: text('cattle.fields.ageMonths'), value: animal => ageInMonths(animal.birthDate, today) },
      { header: text('cattle.fields.stage'), value: animal => text('cattle.stage.' + animal.currentStage) },
      { header: text('cattle.fields.lot'), value: animal => this.facade.lotNames(animal.id) },
      { header: text('cattle.fields.status'), value: animal => text('cattle.status.' + animal.status) },
      {
        header: text('cattle.fields.exitReason'),
        value: animal => (animal.exitReason ? text('cattle.exitReason.' + animal.exitReason) : null),
      },
      { header: text('cattle.fields.exitDate'), value: animal => (animal.exitDate ? fromIsoDate(animal.exitDate) : null) },
    ];
  }
}
