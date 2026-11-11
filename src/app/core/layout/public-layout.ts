import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppFooter } from './app-footer';

/** Frames the public pages (sign-in, registration, recovery, terms, not found) with the skip link and footer. */
@Component({
  selector: 'ichu-public-layout',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, AppFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="skip-link" href="#main-content">{{ 'common.skipToContent' | translate }}</a>
    <main id="main-content" tabindex="-1"><router-outlet /></main>
    <ichu-app-footer [showLanguageMenu]="true" />`,
  styles: ':host{display:flex;flex-direction:column;min-height:100svh}main{display:flex;flex:1 0 auto;flex-direction:column;outline:none}',
})
export class PublicLayout {}
