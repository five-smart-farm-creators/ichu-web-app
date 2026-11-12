import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type {
  ActivityApplication, ActivityFollowUp, PlannedActivity, RecordApplication, ScheduleActivity, ScheduleFollowUp,
} from '../../domain/model/planned-activity.model';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';

/** Reads one activity with its applications and follow-ups, and records what happened or what is due. */
@Injectable()
export class PlannedActivityFacade {
  private readonly activities = inject(PlannedActivityRepository);
  private ranchId: string | null = null;
  private activityId: string | null = null;

  readonly activity = signal<PlannedActivity | null>(null);
  readonly applications = signal<readonly ActivityApplication[]>([]);
  readonly followUps = signal<readonly ActivityFollowUp[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  async open(ranchId: string, activityId: string): Promise<void> {
    this.ranchId = ranchId;
    this.activityId = activityId;
    this.activity.set(null);
    this.applications.set([]);
    this.followUps.set([]);
    this.error.set(null);
    this.loading.set(true);
    try {
      const [activity, applications, followUps] = await Promise.all([
        this.activities.get(ranchId, activityId),
        this.activities.listApplications(ranchId, activityId),
        this.activities.listFollowUps(ranchId, activityId),
      ]);
      this.activity.set(activity);
      this.applications.set(applications);
      this.followUps.set(followUps);
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Records an application of the open activity and reloads its applications. */
  async recordApplication(request: RecordApplication): Promise<void> {
    const { ranchId, activityId } = this.requireOpen();
    await this.activities.recordApplication(ranchId, activityId, request);
    this.applications.set(await this.activities.listApplications(ranchId, activityId));
  }

  /** Schedules a follow-up of the open activity and reloads its follow-ups. */
  async scheduleFollowUp(request: ScheduleFollowUp): Promise<void> {
    const { ranchId, activityId } = this.requireOpen();
    await this.activities.scheduleFollowUp(ranchId, activityId, request);
    this.followUps.set(await this.activities.listFollowUps(ranchId, activityId));
  }

  /** Schedules an activity; the caller reloads whatever list shows it. */
  schedule(ranchId: string, request: ScheduleActivity): Promise<PlannedActivity> {
    return this.activities.schedule(ranchId, request);
  }

  private requireOpen(): { readonly ranchId: string; readonly activityId: string } {
    if (!this.ranchId || !this.activityId) throw new ApiError(0, 'configuration', null);
    return { ranchId: this.ranchId, activityId: this.activityId };
  }
}
