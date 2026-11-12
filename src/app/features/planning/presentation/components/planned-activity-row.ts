import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalizedDatePipe } from '../../../../shared/presentation/localized-date.pipe';
import { type PlannedActivityEntry } from '../../domain/model/planned-activity.model';
import { activityStateKey, activityStateTone } from '../activity-state';

/** One activity in a list: when, what, for which animal, and its state; the whole row opens the activity. */
@Component({
  selector: 'ichu-planned-activity-row',
  imports: [LocalizedDatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="activity-row" (click)="opened.emit()">
      <span class="activity-when">{{ entry().activity.scheduledAt | localizedDate: 'short' }}</span>
      <strong class="activity-title">{{ entry().activity.title }}</strong>
      <span class="activity-animal">{{ animalLabel() || ('planning.calendar.ranchWide' | translate) }}</span>
      <span class="badge" [class]="'badge ' + tone()">{{ stateKey() | translate: { count: entry().progress.daysLate } }}</span>
    </button>`,
  styles: `.activity-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--ink);text-align:left}
    .activity-when,.activity-animal{grid-column:1;color:var(--muted);font-size:.75rem}
    .activity-title{grid-column:1;font-size:.875rem;overflow-wrap:anywhere}
    .activity-row .badge{grid-column:2;grid-row:1 / span 3;align-self:center}`,
})
export class PlannedActivityRow {
  readonly entry = input.required<PlannedActivityEntry>();
  readonly animalLabel = input('');
  readonly opened = output<void>();
  readonly tone = computed(() => activityStateTone(this.entry().progress.state));
  readonly stateKey = computed(() => activityStateKey(this.entry().progress));
}
