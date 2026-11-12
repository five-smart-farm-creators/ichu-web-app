import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, Injector, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../../core/layout/ranch-label';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { formatLocaleTag } from '../../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../../shared/presentation/api-error-message.pipe';
import { ExportFormat, ExportMenu } from '../../../../../shared/presentation/export/export-menu';
import { ExportColumn, TableExportService } from '../../../../../shared/presentation/export/table-export.service';
import { Icon } from '../../../../../shared/presentation/icon';
import { PLANNING_STATE_LIMIT, PlanningCalendarFacade } from '../../../application/services/planning-calendar.facade';
import { type PlannedActivityEntry } from '../../../domain/model/planned-activity.model';
import { type CalendarDay, monthGrid } from '../../../domain/model/planning-calendar';
import { localDay, parseLocalDay } from '../../../domain/model/planning-time';
import { activityStateKey } from '../../activity-state';
import { ActivityDetailDialog } from '../../components/activity-detail-dialog';
import { PlannedActivityRow } from '../../components/planned-activity-row';
import { PLANNING_DIALOG_CONFIG, PLANNING_WIDE_DIALOG_CONFIG } from '../../components/planning-dialog';
import { ScheduleActivityDialog } from '../../components/schedule-activity-dialog';

type CalendarView = 'calendar' | 'agenda';

/** Shows the month grid with activity counts, the selected day, the agenda, and the reminders for the next 7 days and the overdue work. */
@Component({
  selector: 'ichu-planning-calendar-page',
  imports: [ApiErrorMessagePipe, ExportMenu, Icon, MatProgressBarModule, PlannedActivityRow, TranslatePipe],
  providers: [PlanningCalendarFacade],
  templateUrl: './planning-calendar-page.html',
  styleUrl: './planning-calendar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningCalendarPage {
  readonly facade = inject(PlanningCalendarFacade);
  readonly context = inject(IamContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly exportService = inject(TableExportService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  readonly limit = PLANNING_STATE_LIMIT;
  readonly canManage = computed(() => this.context.currentRanch()?.scope === 'Manage');
  readonly canRecordClinical = computed(() => ['ClinicalWrite', 'Manage'].includes(this.context.currentRanch()?.scope ?? ''));
  readonly dateLocale = computed(() => formatLocaleTag(this.language.current()));
  /** Spanish weeks start on Monday and English weeks on Sunday. */
  readonly firstDayOfWeek = computed<0 | 1>(() => (this.language.current() === 'es' ? 1 : 0));
  readonly weeks = computed(() => monthGrid(this.facade.visibleMonth(), this.firstDayOfWeek()));
  readonly weekdays = computed(() => Array.from({ length: 7 }, (_, index) => {
    // 4 January 2026 is a Sunday, so offsetting it by the first weekday yields the header names.
    const weekday = (this.firstDayOfWeek() + index) % 7;
    return formatDate(new Date(2026, 0, 4 + weekday), 'EEE', this.dateLocale());
  }));
  readonly monthTitle = computed(() => formatDate(this.facade.visibleMonth(), 'MMMM y', this.dateLocale()));
  readonly todayKey = computed(() => localDay(this.facade.now()));
  readonly selectedHeading = computed(() => {
    const day = this.facade.selectedDay();
    return day ? formatDate(parseLocalDay(day), 'fullDate', this.dateLocale()) : '';
  });
  readonly view = signal<CalendarView>('calendar');
  readonly notice = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly exportFailed = signal(false);

  constructor() {
    effect(() => {
      const ranchId = this.context.currentRanchId();
      untracked(() => {
        this.notice.set(null);
        void this.facade.open(ranchId);
      });
    });
  }

  shift(months: number): void {
    void this.facade.shiftMonth(months);
  }

  /** Selecting the selected day again clears the selection, so the list returns to its hint. */
  selectDay(day: string): void {
    this.facade.selectDay(this.facade.selectedDay() === day ? null : day);
  }

  count(day: string): number {
    return this.facade.countsByDay().get(day) ?? 0;
  }

  dayLabel(cell: CalendarDay): string {
    return this.translate.instant('planning.calendar.dayLabel', {
      date: formatDate(cell.date, 'fullDate', this.dateLocale()),
      count: this.count(cell.day),
    });
  }

  openSchedule(): void {
    const ranchId = this.context.currentRanchId();
    if (!ranchId) return;
    this.dialog.open(ScheduleActivityDialog, { ...PLANNING_DIALOG_CONFIG, injector: this.injector, data: { ranchId, campaignId: null } })
      .afterClosed()
      .subscribe(outcome => {
        if (outcome !== 'saved') return;
        this.notice.set('planning.activities.scheduled');
        void this.facade.reload();
      });
  }

  /** Recording an application changes the state of the activity, so the calendar reloads whatever the dialog ended with. */
  openActivity(entry: PlannedActivityEntry): void {
    const ranchId = this.context.currentRanchId();
    if (!ranchId) return;
    this.dialog.open(ActivityDetailDialog, {
      ...PLANNING_WIDE_DIALOG_CONFIG,
      injector: this.injector,
      data: {
        ranchId,
        activity: entry.activity,
        canManage: this.canManage(),
        canRecordClinical: this.canRecordClinical(),
      },
    }).afterClosed().subscribe(() => void this.facade.reload());
  }

  async export(format: ExportFormat): Promise<void> {
    this.exporting.set(true);
    this.exportFailed.set(false);
    try {
      const entries = this.facade.monthEntries();
      const columns = this.exportColumns();
      if (format === 'excel') {
        await this.exportService.exportExcel('ichu-planning-agenda', columns, entries);
      } else {
        const subtitle = currentRanchLabel(this.context, this.translate)
          + ' · ' + formatDate(this.facade.visibleMonth(), 'MMMM y', this.dateLocale());
        const title = 'ICHU · ' + this.translate.instant('planning.calendar.agendaTitle');
        await this.exportService.exportPdf('ichu-planning-agenda', title, columns, entries, subtitle);
      }
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private exportColumns(): ExportColumn<PlannedActivityEntry>[] {
    const text = (key: string): string => this.translate.instant(key);
    return [
      { header: text('planning.fields.scheduledAt'), value: entry => new Date(entry.activity.scheduledAt) },
      { header: text('planning.fields.title'), value: entry => entry.activity.title },
      { header: text('planning.fields.animal'), value: entry => this.facade.earTag(entry.activity.cattleId) || text('planning.calendar.ranchWide') },
      {
        header: text('planning.fields.state'),
        value: entry => this.translate.instant(activityStateKey(entry.progress), { count: entry.progress.daysLate }),
      },
    ];
  }
}
