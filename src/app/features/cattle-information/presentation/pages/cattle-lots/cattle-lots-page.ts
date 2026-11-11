import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { ApiError, toApiError } from '../../../../../shared/infrastructure/http/api-error';
import { dateLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { TranslatedPaginatorIntl } from '../../../../../shared/presentation/paginator/translated-paginator-intl';
import { LotMember, LotsFacade } from '../../../application/services/lots.facade';
import { type CattleStatus } from '../../../domain/model/cattle.model';
import type { Lot } from '../../../domain/model/lot.model';
import { CATTLE_DIALOG_CONFIG } from '../../components/cattle-dialog';
import { CreateLotDialog } from '../../components/create-lot-dialog';
import { currentRanchLabel } from '../../ranch-label';
import { CattleErrorMessagePipe } from '../../pipes/cattle-error-message.pipe';

/** One exported row per membership; a lot without members still appears once, with empty animal columns. */
interface LotExportRow {
  readonly lotName: string;
  readonly criterion: string | null;
  readonly earTag: string | null;
  readonly status: CattleStatus | null;
  readonly assignedAt: string | null;
}

function slicePage<T>(items: readonly T[], pageIndex: number, pageSize: number): readonly T[] {
  return items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
}

/** Lists the ranch's lots, opens one to see its animals by ear tag, and adds or removes animals. */
@Component({
  selector: 'ichu-cattle-lots-page',
  imports: [
    CattleErrorMessagePipe,
    DatePipe,
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
  providers: [LotsFacade, { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './cattle-lots-page.html',
  styleUrl: './cattle-lots-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CattleLotsPage {
  readonly facade = inject(LotsFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly lotColumns = ['name', 'criterion', 'members', 'open'];
  readonly memberColumns = ['earTag', 'status', 'assignedAt', 'remove'];
  readonly pageSizeOptions = [10, 25];
  readonly lotPageIndex = signal(0);
  readonly lotPageSize = signal(10);
  readonly memberPageIndex = signal(0);
  readonly memberPageSize = signal(10);
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly dateLocale = computed(() => dateLocaleTag(this.language.current()));
  readonly pagedLots = computed(() => slicePage(this.facade.lots(), this.lotPageIndex(), this.lotPageSize()));
  readonly pagedMembers = computed(() => slicePage(this.facade.members(), this.memberPageIndex(), this.memberPageSize()));
  readonly addForm = new FormGroup({
    cattleId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly saving = signal(false);
  readonly actionError = signal<ApiError | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  readonly notice = signal<string | null>(null);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.lotPageIndex.set(0);
        this.memberPageIndex.set(0);
        this.notice.set(null);
        this.actionError.set(null);
        void this.facade.open(ranchId);
      });
    });
  }

  onLotPage(event: PageEvent): void {
    this.lotPageIndex.set(event.pageIndex);
    this.lotPageSize.set(event.pageSize);
  }

  onMemberPage(event: PageEvent): void {
    this.memberPageIndex.set(event.pageIndex);
    this.memberPageSize.set(event.pageSize);
  }

  selectLot(lotId: string): void {
    this.facade.selectLot(lotId);
    this.memberPageIndex.set(0);
    this.actionError.set(null);
  }

  async addAnimal(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const cattleId = this.addForm.getRawValue().cattleId;
    if (await this.run(() => this.facade.addAnimal(cattleId))) {
      this.addForm.reset({ cattleId: '' });
    }
  }

  removeAnimal(member: LotMember): void {
    void this.run(() => this.facade.removeAnimal(member.cattleId));
  }

  openCreateLot(): void {
    this.dialog.open(CreateLotDialog, { ...CATTLE_DIALOG_CONFIG, injector: this.injector })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome === 'saved') this.notice.set('cattle.lots.created');
      });
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.exportRows();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-lots', columns, rows);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate) + ' · '
          + formatDate(new Date(), 'mediumDate', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('pages.lots');
        await this.exportService.exportPdf('ichu-lots', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private async run(operation: () => Promise<void>): Promise<boolean> {
    this.saving.set(true);
    this.actionError.set(null);
    try {
      await operation();
      return true;
    } catch (error) {
      this.actionError.set(toApiError(error));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private exportRows(): LotExportRow[] {
    const animals = this.facade.animalsById();
    return this.facade.lots().flatMap((lot: Lot): LotExportRow[] => {
      const base = { lotName: lot.name, criterion: lot.criterion };
      if (lot.memberships.length === 0) {
        return [{ ...base, earTag: null, status: null, assignedAt: null }];
      }
      return lot.memberships.map(membership => {
        const animal = animals.get(membership.cattleId);
        return {
          ...base,
          earTag: animal?.earTag ?? null,
          status: animal?.status ?? null,
          assignedAt: membership.assignedAt,
        };
      });
    });
  }

  private exportColumns(): ExportColumn<LotExportRow>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('cattle.fields.name'), value: row => row.lotName },
      { header: text('cattle.fields.criterion'), value: row => row.criterion },
      { header: text('cattle.fields.earTag'), value: row => row.earTag },
      { header: text('cattle.fields.status'), value: row => (row.status ? text('cattle.status.' + row.status) : null) },
      { header: text('cattle.lots.assignedOn'), value: row => (row.assignedAt ? new Date(row.assignedAt) : null) },
    ];
  }
}
