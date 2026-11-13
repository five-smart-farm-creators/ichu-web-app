import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Frames the herd overview and the threshold settings with one tab bar; an animal's monitoring page opens outside it. */
@Component({
  selector: 'ichu-monitoring-area-layout',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav mat-tab-nav-bar class="area-tabs" mat-stretch-tabs="false" [tabPanel]="areaPanel" [attr.aria-label]="'monitoring.areaNavigation' | translate">
      <a mat-tab-link routerLink="/monitoring" routerLinkActive #overviewTab="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }" [active]="overviewTab.isActive" ariaCurrentWhenActive="page">
        {{ 'monitoring.tabs.overview' | translate }}
      </a>
      <a mat-tab-link routerLink="/monitoring/thresholds" routerLinkActive #thresholdsTab="routerLinkActive"
        [active]="thresholdsTab.isActive" ariaCurrentWhenActive="page">
        {{ 'monitoring.tabs.thresholds' | translate }}
      </a>
    </nav>
    <mat-tab-nav-panel #areaPanel><router-outlet /></mat-tab-nav-panel>`,
  styles: ':host{display:block}.area-tabs{margin-bottom:22px}',
})
export class MonitoringAreaLayout {}
