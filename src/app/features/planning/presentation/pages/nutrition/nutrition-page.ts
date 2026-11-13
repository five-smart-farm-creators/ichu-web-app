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
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { type ChartMarker, type ChartSeries, LineChart } from '../../../../../shared/presentation/charts/line-chart';
import { Icon } from '../../../../../shared/presentation/icon';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { PluralPipe } from '../../../../../shared/presentation/plural.pipe';
import { NutritionFacade } from '../../../application/services/nutrition.facade';
import { lotDailyKilograms, type NutritionPlan, type RationItem } from '../../../domain/model/nutrition-plan.model';
import { parseLocalDay } from '../../../domain/model/planning-time';
import { PLANNING_WIDE_DIALOG_CONFIG } from '../../components/planning-dialog';
import { RegisterNutritionPlanDialog } from '../../components/register-nutrition-plan-dialog';

/** The ration of one lot: the plan in force with its feed estimate, the rumination around its ration changes, and the plan history. */
@Component({
  selector: 'ichu-nutrition-page',
  imports: [
    ApiErrorMessagePipe,
    Icon,
    LineChart,
    LocalizedDatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PluralPipe,
    TranslatePipe,
  ],
  providers: [NutritionFacade],
  templateUrl: './nutrition-page.html',
  styleUrl: './nutrition-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NutritionPage {
  readonly facade = inject(NutritionFacade);
  readonly context = inject(IamContextFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly routeLotId = toSignal(this.route.paramMap.pipe(map(params => params.get('lotId'))), { initialValue: null });
  readonly itemColumns = ['feed', 'kind', 'perHead', 'perLot'];
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  readonly oneDecimal = computed(() => new Intl.NumberFormat(this.dateLocale(), { maximumFractionDigits: 1 }));
  readonly twoDecimals = computed(() => new Intl.NumberFormat(this.dateLocale(), { maximumFractionDigits: 2 }));
  readonly gainDecimals = computed(() => new Intl.NumberFormat(this.dateLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
  readonly notice = signal<string | null>(null);
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly chartSeries = computed<ChartSeries[]>(() => {
    const days = this.facade.rumination()?.days ?? [];
    return [{
      label: this.translated('nutrition.rumination.series'),
      color: '--forest',
      points: days.map(day => ({ x: parseLocalDay(day.day), y: day.value })),
    }];
  });
  readonly chartMarkers = computed<ChartMarker[]>(() => {
    const label = this.translated('nutrition.rumination.changeMarker');
    return (this.facade.rumination()?.changeDays ?? []).map(day => ({ x: parseLocalDay(day), label }));
  });

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      const lotId = this.routeLotId();
      untracked(() => {
        this.notice.set(null);
        void this.facade.open(ranchId, lotId);
      });
    });
  }

  choose(lotId: string): void {
    void this.facade.selectLot(lotId || null);
  }

  openRegister(): void {
    const lot = this.facade.selectedLot();
    if (!lot) return;
    this.dialog.open(RegisterNutritionPlanDialog, {
      ...PLANNING_WIDE_DIALOG_CONFIG, injector: this.injector, data: { lotName: lot.name },
    })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome === 'saved') this.notice.set('nutrition.record.saved');
      });
  }

  /** Kilograms of one feed that the whole lot eats each day, an estimate from the head count; null without a count. */
  lotKilograms(item: RationItem): number | null {
    const heads = this.facade.headCount();
    return heads === null ? null : item.kilogramsPerHeadPerDay * heads;
  }

  lotTotal(plan: NutritionPlan): number | null {
    const heads = this.facade.headCount();
    return heads === null ? null : lotDailyKilograms(plan.items, heads);
  }

  /** Formats a value in the language in use; a value that could not be read stays blank, never zero. */
  formatted(format: Intl.NumberFormat, value: number | null): string {
    return value === null ? '' : format.format(value);
  }

  /** Reads the language signal, so a label built here is translated again after a language switch. */
  private translated(key: string): string {
    void this.language.current();
    return this.translate.instant(key);
  }
}
