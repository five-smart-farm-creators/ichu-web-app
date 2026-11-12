import { computed, inject, Injectable, signal } from '@angular/core';
import { mapWithConcurrency } from '../../../../shared/infrastructure/async/map-with-concurrency';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  activityProgress, activityReminders, type PlannedActivityEntry,
} from '../../domain/model/planned-activity.model';
import { monthPeriod, type PlanningPeriod, reminderPeriod } from '../../domain/model/planning-calendar';
import { localDay, startOfMonth } from '../../domain/model/planning-time';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';

/** Applications are read for at most this many activities per period, so a busy month cannot flood the API. */
export const PLANNING_STATE_LIMIT = 200;

/** Application reads in flight at once. */
const STATE_REQUEST_CONCURRENCY = 4;

/** Coordinates the calendar of one ranch: the visible month, the selected day, the animals it names, and the reminders. */
@Injectable()
export class PlanningCalendarFacade {
  private readonly activities = inject(PlannedActivityRepository);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private ranchId: string | null = null;
  private monthRequest = 0;
  private reminderRequest = 0;

  readonly visibleMonth = signal(startOfMonth(new Date()));
  readonly selectedDay = signal<string | null>(null);
  readonly now = signal(new Date());
  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  readonly monthEntries = signal<readonly PlannedActivityEntry[]>([]);
  readonly reminderEntries = signal<readonly PlannedActivityEntry[]>([]);
  readonly limited = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  private readonly earTagById = computed(() => new Map(this.animals().map(animal => [animal.cattleId, animal.earTag] as const)));

  /** Activities per local day of the visible month, which the grid shows as count chips. */
  readonly countsByDay = computed(() => {
    const counts = new Map<string, number>();
    for (const { activity } of this.monthEntries()) {
      const day = localDay(new Date(activity.scheduledAt));
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  });

  readonly selectedEntries = computed(() => {
    const day = this.selectedDay();
    if (!day) return [];
    return this.monthEntries().filter(entry => localDay(new Date(entry.activity.scheduledAt)) === day);
  });

  readonly reminders = computed(() => activityReminders(this.reminderEntries(), reminderPeriod(this.now()).to));

  /** Names the animal of an activity; an activity without an animal, or an animal no longer listed, reads as empty. */
  earTag(cattleId: string | null): string {
    return cattleId ? (this.earTagById().get(cattleId) ?? '') : '';
  }

  /** Loads the animals, the visible month, and the reminders; a null ranch clears the calendar. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.visibleMonth.set(startOfMonth(new Date()));
    this.selectedDay.set(null);
    this.animals.set([]);
    this.monthEntries.set([]);
    this.reminderEntries.set([]);
    this.limited.set(false);
    this.error.set(null);
    if (!ranchId) return;
    await Promise.all([this.loadAnimals(ranchId), this.reload()]);
  }

  /** Reloads both windows, for example after an activity was scheduled or an application recorded. */
  async reload(): Promise<void> {
    await Promise.all([this.loadMonth(), this.loadReminders()]);
  }

  private async loadAnimals(ranchId: string): Promise<void> {
    try {
      const animals = await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY);
      if (ranchId === this.ranchId) this.animals.set(animals);
    } catch (error) {
      if (ranchId === this.ranchId) this.error.set(toApiError(error));
    }
  }

  /** Moves the visible month by whole months and clears the selected day, which may now be outside it. */
  shiftMonth(months: number): Promise<void> {
    const current = this.visibleMonth();
    this.visibleMonth.set(new Date(current.getFullYear(), current.getMonth() + months, 1));
    this.selectedDay.set(null);
    return this.loadMonth();
  }

  selectDay(day: string | null): void {
    this.selectedDay.set(day);
  }

  private async loadMonth(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.monthRequest;
    this.now.set(new Date());
    this.loading.set(true);
    this.error.set(null);
    try {
      const { entries, limited } = await this.readEntries(ranchId, monthPeriod(this.visibleMonth()));
      if (request === this.monthRequest) {
        this.monthEntries.set(entries);
        this.limited.set(limited);
      }
    } catch (error) {
      if (request === this.monthRequest) this.error.set(toApiError(error));
    } finally {
      if (request === this.monthRequest) this.loading.set(false);
    }
  }

  private async loadReminders(): Promise<void> {
    const ranchId = this.ranchId;
    if (!ranchId) return;
    const request = ++this.reminderRequest;
    this.now.set(new Date());
    try {
      const { entries } = await this.readEntries(ranchId, reminderPeriod(this.now()));
      if (request === this.reminderRequest) this.reminderEntries.set(entries);
    } catch (error) {
      if (request === this.reminderRequest) this.error.set(toApiError(error));
    }
  }

  /** Reads the applications of each activity so its state is known; activities beyond the limit are left out and flagged. */
  private async readEntries(
    ranchId: string,
    period: PlanningPeriod,
  ): Promise<{ readonly entries: PlannedActivityEntry[]; readonly limited: boolean }> {
    const activities = await this.activities.calendar(ranchId, period);
    const checked = activities.slice(0, PLANNING_STATE_LIMIT);
    const now = this.now();
    const counts = await mapWithConcurrency(checked, STATE_REQUEST_CONCURRENCY, async activity =>
      (await this.activities.listApplications(ranchId, activity.id)).length);
    return {
      entries: checked.map((activity, index) => ({ activity, progress: activityProgress(activity, counts[index], now) })),
      limited: activities.length > PLANNING_STATE_LIMIT,
    };
  }
}
