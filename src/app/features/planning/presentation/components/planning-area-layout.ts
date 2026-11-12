import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Frames the calendar, the campaigns and the withdrawal periods with one tab bar. */
@Component({
  selector: 'ichu-planning-area-layout',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav mat-tab-nav-bar class="area-tabs" [tabPanel]="areaPanel" [attr.aria-label]="'planning.areaNavigation' | translate">
      <a mat-tab-link routerLink="/planning" routerLinkActive #calendarTab="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }" [active]="calendarTab.isActive" ariaCurrentWhenActive="page">
        {{ 'planning.tabs.calendar' | translate }}
      </a>
      <a mat-tab-link routerLink="/planning/campaigns" routerLinkActive #campaignsTab="routerLinkActive"
        [active]="campaignsTab.isActive" ariaCurrentWhenActive="page">
        {{ 'planning.tabs.campaigns' | translate }}
      </a>
      <a mat-tab-link routerLink="/planning/withdrawal-periods" routerLinkActive #withdrawalTab="routerLinkActive"
        [active]="withdrawalTab.isActive" ariaCurrentWhenActive="page">
        {{ 'planning.tabs.withdrawal' | translate }}
      </a>
    </nav>
    <mat-tab-nav-panel #areaPanel><router-outlet /></mat-tab-nav-panel>`,
  styles: ':host{display:block}.area-tabs{margin-bottom:22px}',
})
export class PlanningAreaLayout {}
