import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { provideLocalizedDateAdapter } from '../../../../shared/presentation/localized-date-providers';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import {
  type ClinicalInterventionSummary, OperationsMonitoringContextFacade,
} from '../../../operations-monitoring/application/acl/operations-monitoring-context.facade';
import { PlannedActivityFacade } from '../../application/services/planned-activity.facade';
import { combineDayAndTime, defaultTime } from '../../../../shared/presentation/date-time-input';
import { activityProgress, type PlannedActivity } from '../../domain/model/planned-activity.model';
import { activityStateKey, activityStateTone } from '../activity-state';

export interface ActivityDetailData {
  readonly ranchId: string;
  readonly activity: PlannedActivity;
  readonly canManage: boolean;
  readonly canRecordClinical: boolean;
}

/** Shows what was applied to an activity and what follows up, and records the next application or follow-up. */
@Component({
  selector: 'ichu-activity-detail-dialog',
  imports: [
    ApiErrorMessagePipe,
    LocalizedDatePipe,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [PlannedActivityFacade, provideLocalizedDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ data.activity.title }}</h2>
    <mat-dialog-content>
      @if (facade.loading()) {
        <mat-progress-bar mode="indeterminate" [attr.aria-label]="'planning.activities.loading' | translate" />
      }
      @if (facade.error(); as apiError) {
        <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
      }
      <dl class="dialog-facts">
        <div>
          <dt>{{ 'planning.fields.scheduledAt' | translate }}</dt>
          <dd>{{ data.activity.scheduledAt | localizedDate: 'short' }}</dd>
        </div>
        <div>
          <dt>{{ 'planning.fields.animal' | translate }}</dt>
          <dd>{{ animalLabel(data.activity.cattleId) || ('planning.calendar.ranchWide' | translate) }}</dd>
        </div>
        <div>
          <dt>{{ 'planning.fields.state' | translate }}</dt>
          <dd><span class="badge" [class]="'badge ' + stateTone()">{{ stateKey() | translate: { count: daysLate() } }}</span></dd>
        </div>
      </dl>

      <h3 class="dialog-section">{{ 'planning.activities.applications' | translate }}</h3>
      <ul class="dialog-list">
        @for (application of facade.applications(); track application.id) {
          <li>
            <strong>{{ application.appliedAt | localizedDate: 'short' }} · {{ animalLabel(application.cattleId) }}</strong>
            @if (application.interventionId) {
              @if (linkedDay(application.cattleId, application.interventionId); as day) {
                <span class="text-muted">{{ 'planning.activities.linkedOn' | translate: { date: day } }}</span>
              } @else {
                <span class="text-muted">{{ 'planning.activities.linkedUnknown' | translate }}</span>
              }
            }
          </li>
        } @empty {
          <li class="text-muted">{{ 'planning.activities.noApplications' | translate }}</li>
        }
      </ul>

      @if (data.canRecordClinical) {
        <form [formGroup]="applicationForm" (ngSubmit)="recordApplication()" novalidate>
          <div class="dialog-grid">
            <mat-form-field appearance="outline" class="span-two">
              <mat-label>{{ 'planning.fields.animal' | translate }}</mat-label>
              <mat-select formControlName="cattleId" (selectionChange)="chooseAnimal($event.value)">
                @for (animal of animals(); track animal.cattleId) {
                  <mat-option [value]="animal.cattleId">{{ animal.earTag }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'planning.fields.appliedDay' | translate }}</mat-label>
              <input matInput [matDatepicker]="appliedPicker" formControlName="day" autocomplete="off">
              <mat-datepicker-toggle matIconSuffix [for]="appliedPicker" />
              <mat-datepicker #appliedPicker />
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'planning.fields.time' | translate }}</mat-label>
              <input matInput type="time" formControlName="time">
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="span-two">
              <mat-label>{{ 'planning.fields.linkedIntervention' | translate }}</mat-label>
              <mat-select formControlName="interventionId">
                <mat-option value="">{{ 'planning.activities.noIntervention' | translate }}</mat-option>
                @for (intervention of interventionsFor(applicationForm.controls.cattleId.value); track intervention.interventionId) {
                  <mat-option [value]="intervention.interventionId">
                    {{ ('health.type.' + intervention.type) | translate }} · {{ intervention.occurredAt | localizedDate: 'mediumDate' }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          @if (applicationError(); as apiError) {
            <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
          }
          <div class="dialog-form-actions">
            <button type="submit" class="btn primary" [disabled]="savingApplication()">
              {{ (savingApplication() ? 'common.saving' : 'planning.activities.recordApplication') | translate }}
            </button>
          </div>
        </form>
      }

      <h3 class="dialog-section">{{ 'planning.activities.followUps' | translate }}</h3>
      <ul class="dialog-list">
        @for (followUp of facade.followUps(); track followUp.id) {
          <li><strong>{{ followUp.dueAt | localizedDate: 'short' }}</strong></li>
        } @empty {
          <li class="text-muted">{{ 'planning.activities.noFollowUps' | translate }}</li>
        }
      </ul>

      @if (data.canManage) {
        <form [formGroup]="followUpForm" (ngSubmit)="scheduleFollowUp()" novalidate>
          <div class="dialog-grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'planning.fields.dueDay' | translate }}</mat-label>
              <input matInput [matDatepicker]="duePicker" formControlName="day" autocomplete="off">
              <mat-datepicker-toggle matIconSuffix [for]="duePicker" />
              <mat-datepicker #duePicker />
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'planning.fields.time' | translate }}</mat-label>
              <input matInput type="time" formControlName="time">
              <mat-error>{{ 'common.required' | translate }}</mat-error>
            </mat-form-field>
          </div>
          @if (followUpError(); as apiError) {
            <p class="form-error" role="alert">{{ apiError | apiErrorMessage }}</p>
          }
          <div class="dialog-form-actions">
            <button type="submit" class="btn primary" [disabled]="savingFollowUp()">
              {{ (savingFollowUp() ? 'common.saving' : 'planning.activities.scheduleFollowUp') | translate }}
            </button>
          </div>
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" class="btn secondary" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>`,
  styleUrl: '../styles/planning-dialog.scss',
})
export class ActivityDetailDialog {
  readonly data = inject<ActivityDetailData>(MAT_DIALOG_DATA);
  readonly facade = inject(PlannedActivityFacade);
  private readonly cattleContext = inject(CattleInformationContextFacade);
  private readonly operations = inject(OperationsMonitoringContextFacade);
  private readonly language = inject(LanguageService);
  readonly animals = signal<readonly MonitoredCattleSummary[]>([]);
  private readonly interventionsByCattle = signal<ReadonlyMap<string, readonly ClinicalInterventionSummary[]>>(new Map());
  readonly savingApplication = signal(false);
  readonly savingFollowUp = signal(false);
  readonly applicationError = signal<ApiError | null>(null);
  readonly followUpError = signal<ApiError | null>(null);
  readonly progress = computed(() => activityProgress(this.data.activity, this.facade.applications().length, new Date()));
  readonly stateTone = computed(() => activityStateTone(this.progress().state));
  readonly stateKey = computed(() => activityStateKey(this.progress()));
  readonly daysLate = computed(() => this.progress().daysLate);

  private readonly animalNames = computed(() => new Map(this.animals().map(animal => [animal.cattleId, animal.earTag] as const)));

  readonly applicationForm = new FormGroup({
    cattleId: new FormControl({ value: this.data.activity.cattleId ?? '', disabled: this.data.activity.cattleId !== null }, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    day: new FormControl<Date | null>(new Date(), Validators.required),
    time: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
    interventionId: new FormControl('', { nonNullable: true }),
  });

  readonly followUpForm = new FormGroup({
    day: new FormControl<Date | null>(new Date(), Validators.required),
    time: new FormControl(defaultTime(), { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    const { ranchId, activity } = this.data;
    void this.facade.open(ranchId, activity.id);
    void this.loadAnimals(ranchId);
    if (activity.cattleId) void this.loadInterventions(ranchId, activity.cattleId);
  }

  animalLabel(cattleId: string | null): string {
    return cattleId ? (this.animalNames().get(cattleId) ?? '') : '';
  }

  /** The chosen animal decides which clinical interventions can be linked. */
  chooseAnimal(cattleId: string): void {
    this.applicationForm.controls.interventionId.setValue('');
    if (cattleId) void this.loadInterventions(this.data.ranchId, cattleId);
  }

  interventionsFor(cattleId: string | null): readonly ClinicalInterventionSummary[] {
    return cattleId ? (this.interventionsByCattle().get(cattleId) ?? []) : [];
  }

  /** The day of a linked intervention, or null while the intervention is not in the loaded list. */
  linkedDay(cattleId: string, interventionId: string): string | null {
    const intervention = this.interventionsFor(cattleId).find(item => item.interventionId === interventionId);
    return intervention ? formatDate(intervention.occurredAt, 'mediumDate', formatLocaleTag(this.language.current())) : null;
  }

  async recordApplication(): Promise<void> {
    this.applicationForm.markAllAsTouched();
    const { cattleId, day, time, interventionId } = this.applicationForm.getRawValue();
    const appliedAt = combineDayAndTime(day, time);
    if (this.applicationForm.invalid || !cattleId || !appliedAt || this.savingApplication()) return;
    this.savingApplication.set(true);
    this.applicationError.set(null);
    try {
      await this.facade.recordApplication({ cattleId, appliedAt: appliedAt.toISOString(), interventionId: interventionId || null });
      this.applicationForm.controls.interventionId.setValue('');
    } catch (error) {
      this.applicationError.set(toApiError(error));
    } finally {
      this.savingApplication.set(false);
    }
  }

  async scheduleFollowUp(): Promise<void> {
    this.followUpForm.markAllAsTouched();
    const { day, time } = this.followUpForm.getRawValue();
    const dueAt = combineDayAndTime(day, time);
    if (this.followUpForm.invalid || !dueAt || this.savingFollowUp()) return;
    this.savingFollowUp.set(true);
    this.followUpError.set(null);
    try {
      await this.facade.scheduleFollowUp({ dueAt: dueAt.toISOString() });
    } catch (error) {
      this.followUpError.set(toApiError(error));
    } finally {
      this.savingFollowUp.set(false);
    }
  }

  private async loadAnimals(ranchId: string): Promise<void> {
    try {
      this.animals.set(await this.cattleContext.monitoredCattle(ranchId, { activeOnly: false }, Number.POSITIVE_INFINITY));
    } catch (error) {
      this.applicationError.set(toApiError(error));
    }
  }

  private async loadInterventions(ranchId: string, cattleId: string): Promise<void> {
    try {
      const interventions = await this.operations.interventionsFor(ranchId, cattleId);
      this.interventionsByCattle.update(map => new Map(map).set(cattleId, interventions));
    } catch (error) {
      this.applicationError.set(toApiError(error));
    }
  }
}
