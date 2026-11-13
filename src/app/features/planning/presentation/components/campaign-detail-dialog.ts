import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningCampaignsFacade } from '../../application/services/planning-campaigns.facade';
import type { PlannedActivity } from '../../domain/model/planned-activity.model';
import { campaignStatus, type PlanningCampaign } from '../../domain/model/planning-campaign.model';
import { localDay, parseLocalDay } from '../../domain/model/planning-time';
import { ActivityDetailDialog } from './activity-detail-dialog';
import { PLANNING_DIALOG_CONFIG, PLANNING_WIDE_DIALOG_CONFIG } from './planning-dialog';
import { ScheduleActivityDialog } from './schedule-activity-dialog';

export interface CampaignDetailData {
  readonly ranchId: string;
  readonly campaign: PlanningCampaign;
  readonly canManage: boolean;
  readonly canRecordClinical: boolean;
}

/** Shows one campaign with its dated activities; a managing account schedules more and opens each activity. */
@Component({
  selector: 'ichu-campaign-detail-dialog',
  imports: [ApiErrorMessagePipe, LocalizedDatePipe, MatDialogModule, MatProgressBarModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ campaign().name }}</h2>
    <mat-dialog-content>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'planning.campaigns.detail.loading' | translate" />
      }
      @if (error(); as apiError) {
        <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
      }
      <dl class="dialog-facts">
        <div>
          <dt>{{ 'planning.fields.kind' | translate }}</dt>
          <dd>{{ ('planning.kind.' + campaign().kind) | translate }}</dd>
        </div>
        <div>
          <dt>{{ 'planning.fields.status' | translate }}</dt>
          <dd><span class="badge" [class]="'badge ' + statusTone()">{{ ('planning.campaignStatus.' + status()) | translate }}</span></dd>
        </div>
        <div>
          <dt>{{ 'planning.fields.startsOn' | translate }}</dt>
          <dd>{{ startDate() | localizedDate: 'mediumDate' }}</dd>
        </div>
        <div>
          <dt>{{ 'planning.fields.endsOn' | translate }}</dt>
          <dd>{{ endDate() | localizedDate: 'mediumDate' }}</dd>
        </div>
      </dl>

      <h3 class="dialog-section">{{ 'planning.campaigns.detail.activities' | translate }}</h3>
      <ul class="dialog-list">
        @for (activity of activities(); track activity.id) {
          <li>
            <span class="text-muted">{{ activity.scheduledAt | localizedDate: 'short' }} · {{ animalLabel(activity.cattleId) || ('planning.calendar.ranchWide' | translate) }}</span>
            <strong>{{ activity.title }}</strong>
            <span>
              <button type="button" class="btn secondary" (click)="openActivity(activity)">
                {{ 'planning.activities.open' | translate }}
                <span class="visually-hidden">{{ activity.title }}</span>
              </button>
            </span>
          </li>
        } @empty {
          @if (!loading()) {
            <li class="text-muted">{{ 'planning.campaigns.detail.noActivities' | translate }}</li>
          }
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.canManage) {
        <button type="button" class="btn primary" (click)="scheduleActivity()">{{ 'planning.activities.schedule.open' | translate }}</button>
      }
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>`,
})
export class CampaignDetailDialog {
  readonly data = inject<CampaignDetailData>(MAT_DIALOG_DATA);
  private readonly campaignsFacade = inject(PlanningCampaignsFacade);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  readonly campaign = signal<PlanningCampaign>(this.data.campaign);
  readonly activities = signal<readonly PlannedActivity[]>([]);
  private readonly animals = signal<ReadonlyMap<string, string>>(new Map());
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly status = computed(() => campaignStatus(this.campaign(), localDay(new Date())));
  readonly statusTone = computed(() => ({ Upcoming: 'neutral', Active: 'success', Finished: 'neutral' })[this.status()]);
  readonly startDate = computed(() => parseLocalDay(this.campaign().startsOn));
  readonly endDate = computed(() => parseLocalDay(this.campaign().endsOn));

  constructor() {
    void this.load();
  }

  animalLabel(cattleId: string | null): string {
    return cattleId ? (this.animals().get(cattleId) ?? '') : '';
  }

  scheduleActivity(): void {
    this.dialog.open(ScheduleActivityDialog, {
      ...PLANNING_DIALOG_CONFIG,
      injector: this.injector,
      data: { ranchId: this.data.ranchId, campaignId: this.campaign().id },
    }).afterClosed().subscribe(outcome => {
      if (outcome === 'saved') void this.load();
    });
  }

  openActivity(activity: PlannedActivity): void {
    this.dialog.open(ActivityDetailDialog, {
      ...PLANNING_WIDE_DIALOG_CONFIG,
      injector: this.injector,
      data: {
        ranchId: this.data.ranchId,
        activity,
        canManage: this.data.canManage,
        canRecordClinical: this.data.canRecordClinical,
      },
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [campaign, animals] = await Promise.all([
        this.campaignsFacade.read(this.data.campaign.id),
        this.cattleContext.monitoredCattle(this.data.ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY),
      ]);
      const activities = await this.campaignsFacade.activitiesOf(campaign);
      this.campaign.set(campaign);
      this.animals.set(new Map(animals.map((animal: MonitoredCattleSummary) => [animal.cattleId, animal.earTag] as const)));
      this.activities.set(activities);
    } catch (error) {
      this.error.set(toApiError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
