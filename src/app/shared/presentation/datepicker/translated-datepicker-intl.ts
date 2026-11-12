import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { TranslateService } from '@ngx-translate/core';

/** Translates the calendar's built-in labels; they are reapplied on each language change so open pickers follow it. */
@Injectable()
export class TranslatedDatepickerIntl extends MatDatepickerIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.applyLabels();
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => {
      this.applyLabels();
      this.changes.next();
    });
  }

  override formatYearRange(start: string, end: string): string {
    return this.translate.instant('common.datepicker.yearRange', { start, end });
  }

  override formatYearRangeLabel(start: string, end: string): string {
    return this.translate.instant('common.datepicker.yearRangeLabel', { start, end });
  }

  private applyLabels(): void {
    this.calendarLabel = this.translate.instant('common.datepicker.calendar');
    this.openCalendarLabel = this.translate.instant('common.datepicker.openCalendar');
    this.closeCalendarLabel = this.translate.instant('common.datepicker.closeCalendar');
    this.prevMonthLabel = this.translate.instant('common.datepicker.previousMonth');
    this.nextMonthLabel = this.translate.instant('common.datepicker.nextMonth');
    this.prevYearLabel = this.translate.instant('common.datepicker.previousYear');
    this.nextYearLabel = this.translate.instant('common.datepicker.nextYear');
    this.prevMultiYearLabel = this.translate.instant('common.datepicker.previousYears');
    this.nextMultiYearLabel = this.translate.instant('common.datepicker.nextYears');
    this.switchToMonthViewLabel = this.translate.instant('common.datepicker.chooseDate');
    this.switchToMultiYearViewLabel = this.translate.instant('common.datepicker.chooseMonthAndYear');
  }
}
