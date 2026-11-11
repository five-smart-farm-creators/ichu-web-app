import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Frames the IoT devices, water troughs and edge gateways with one tab bar. */
@Component({
  selector: 'ichu-devices-area-layout',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav mat-tab-nav-bar class="area-tabs" [tabPanel]="areaPanel" [attr.aria-label]="'devices.areaNavigation' | translate">
      <a mat-tab-link routerLink="/devices" routerLinkActive #devicesTab="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: true }" [active]="devicesTab.isActive" ariaCurrentWhenActive="page">
        {{ 'devices.tabs.devices' | translate }}
      </a>
      <a mat-tab-link routerLink="/devices/water-troughs" routerLinkActive #troughsTab="routerLinkActive"
        [active]="troughsTab.isActive" ariaCurrentWhenActive="page">
        {{ 'devices.tabs.waterTroughs' | translate }}
      </a>
      <a mat-tab-link routerLink="/devices/gateways" routerLinkActive #gatewaysTab="routerLinkActive"
        [active]="gatewaysTab.isActive" ariaCurrentWhenActive="page">
        {{ 'devices.tabs.gateways' | translate }}
      </a>
    </nav>
    <mat-tab-nav-panel #areaPanel><router-outlet /></mat-tab-nav-panel>`,
  styles: ':host{display:block}.area-tabs{margin-bottom:22px}',
})
export class DevicesAreaLayout {}
