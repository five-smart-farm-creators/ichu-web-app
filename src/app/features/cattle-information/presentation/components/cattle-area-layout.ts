import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Frames the animal inventory and the lots with one tab bar; an animal profile opens outside it. */
@Component({
  selector: 'ichu-cattle-area-layout',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav mat-tab-nav-bar class="area-tabs" mat-stretch-tabs="false" [tabPanel]="areaPanel" [attr.aria-label]="'cattle.areaNavigation' | translate">
      <a mat-tab-link routerLink="/cattle" routerLinkActive #animalsTab="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }" [active]="animalsTab.isActive" ariaCurrentWhenActive="page">
        {{ 'cattle.tabs.animals' | translate }}
      </a>
      <a mat-tab-link routerLink="/cattle/lots" routerLinkActive #lotsTab="routerLinkActive"
        [active]="lotsTab.isActive" ariaCurrentWhenActive="page">
        {{ 'cattle.tabs.lots' | translate }}
      </a>
    </nav>
    <mat-tab-nav-panel #areaPanel><router-outlet /></mat-tab-nav-panel>`,
  styles: ':host{display:block}.area-tabs{margin-bottom:22px}',
})
export class CattleAreaLayout {}
