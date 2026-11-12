import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PluralPipe, pluralTranslationKey } from '../../../../../shared/presentation/plural.pipe';
import { LivestockOperationRecorder } from '../../../application/services/livestock-operation-recorder';
import { ReproductionFacade } from '../../../application/services/reproduction.facade';
import { type OperationType, registrableTypes } from '../../../domain/model/livestock-operation.model';
import { type ReproductiveTimelineEntry } from '../../../domain/model/reproductive-history.model';
import { MONITORING_DIALOG_CONFIG } from '../../components/monitoring-dialog';
import { RecordOperationDialog, type RecordOperationCopy, type RecordOperationData } from '../../components/record-operation-dialog';

/** The three buttons of the page: a breeding service, a pregnancy diagnosis, and a calving, abortion or heat. */
type RecordKind = 'service' | 'diagnosis' | 'event';

const RECORD_TYPES: Readonly<Record<RecordKind, readonly OperationType[]>> = {
  service: ['NaturalMating', 'Insemination'],
  diagnosis: ['PregnancyDiagnosis'],
  event: ['Birth', 'Abortion', 'HeatObserved'],
};

const RECORD_COPY: Readonly<Record<RecordKind, RecordOperationCopy>> = {
  service: {
    titleKey: 'reproduction.records.serviceTitle', leadKey: 'reproduction.records.serviceLead', submitKey: 'reproduction.records.serviceSubmit',
  },
  diagnosis: {
    titleKey: 'reproduction.records.diagnosisTitle', leadKey: 'reproduction.records.diagnosisLead', submitKey: 'reproduction.records.diagnosisSubmit',
  },
  event: {
    titleKey: 'reproduction.records.eventTitle', leadKey: 'reproduction.records.eventLead', submitKey: 'reproduction.records.eventSubmit',
  },
};

const INTERVAL_COLUMNS = ['calving', 'conception', 'daysOpen'];

/** The reproductive history of one female: her figures, intervals and dated events, with the records that the account may add. */
@Component({
  selector: 'ichu-reproduction-page',
  imports: [
    ApiErrorMessagePipe,
    ExportMenu,
    Icon,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PluralPipe,
    TranslatePipe,
  ],
  providers: [ReproductionFacade, LivestockOperationRecorder],
  templateUrl: './reproduction-page.html',
  styleUrl: './reproduction-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReproductionPage {
  readonly facade = inject(ReproductionFacade);
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly routeCattleId = toSignal(this.route.paramMap.pipe(map(params => params.get('cattleId'))), { initialValue: null });
  readonly intervalColumns = INTERVAL_COLUMNS;
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly ratioFormat = computed(() => new Intl.NumberFormat(this.dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  readonly notice = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);
  private readonly access = computed(() => ({
    canRecordField: this.context.currentRanch()?.scope === 'Manage',
    canRecordClinical: ['ClinicalWrite', 'Manage'].includes(this.context.currentRanch()?.scope ?? ''),
  }));
  readonly canRecord: Readonly<Record<RecordKind, () => boolean>> = {
    service: computed(() => this.typesFor('service').length > 0),
    diagnosis: computed(() => this.typesFor('diagnosis').length > 0),
    event: computed(() => this.typesFor('event').length > 0),
  };

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const cattleId = this.routeCattleId();
      untracked(() => {
        this.notice.set(null);
        void this.facade.open(ranchId, cattleId);
      });
    });
  }

  chooseFemale(cattleId: string): void {
    void this.facade.selectAnimal(cattleId || null);
  }

  openRecord(kind: RecordKind): void {
    const animal = this.facade.animal();
    const ranchId = this.context.currentRanchId();
    const types = this.typesFor(kind);
    if (!animal || !ranchId || types.length === 0) return;
    const data: RecordOperationData = { ranchId, animal, types, copy: RECORD_COPY[kind] };
    this.dialog.open(RecordOperationDialog, { ...MONITORING_DIALOG_CONFIG, injector: this.injector, data })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome !== 'saved') return;
        this.notice.set('reproduction.records.saved');
        void this.facade.refresh();
      });
  }

  /** Exports the timeline; the PDF subtitle names the animal with its stage and age, never its identifiers. */
  async export(format: ExportFormat): Promise<void> {
    const animal = this.facade.animal();
    const history = this.facade.history();
    if (!animal || !history) return;
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const rows = this.facade.timeline();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-reproduction', columns, rows);
      } else {
        const subtitleKey = pluralTranslationKey(
          'reproduction.export.subtitle', history.ageInMonths, this.language.current(),
        );
        const details = this.translate.instant(subtitleKey, {
          earTag: animal.earTag,
          stage: this.translate.instant('cattle.stage.' + history.lifeStage),
          count: history.ageInMonths,
          date: formatDate(new Date(), 'mediumDate', this.dateLocale()),
        });
        const subtitle = currentRanchLabel(this.context, this.translate) + ' · ' + details;
        const title = 'ICHU · ' + this.translate.instant('pages.reproduction');
        await this.exportService.exportPdf('ichu-reproduction', title, columns, rows, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private typesFor(kind: RecordKind): OperationType[] {
    const animal = this.facade.animal();
    return animal ? registrableTypes(RECORD_TYPES[kind], this.access(), animal.sex) : [];
  }

  private exportColumns(): ExportColumn<ReproductiveTimelineEntry>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('health.fields.occurredAt'), value: entry => new Date(entry.occurredAt) },
      { header: text('reproduction.columns.event'), value: entry => text('reproduction.event.' + entry.kind) },
      { header: text('reproduction.columns.detail'), value: entry => detailText(entry, text) },
      { header: text('health.fields.sireReference'), value: entry => entry.sireReference },
      {
        header: text('health.fields.expectedCalvingDate'),
        value: entry => (entry.expectedCalvingDate ? new Date(`${entry.expectedCalvingDate}T00:00:00`) : null),
      },
    ];
  }
}

function detailText(entry: ReproductiveTimelineEntry, text: (key: string) => string): string | null {
  if (entry.method) return text('health.type.' + entry.method);
  if (entry.result) return text('reproduction.pregnancyResult.' + entry.result);
  return null;
}
