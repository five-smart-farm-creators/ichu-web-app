import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { type AppLanguage, SUPPORTED_LANGUAGES } from '../infrastructure/i18n/language';
import { LanguageService } from '../infrastructure/i18n/language.service';
import { Icon } from './icon';

/** Each language is named in its own words so speakers can find theirs whatever the current language is. */
const LANGUAGE_NAMES: Readonly<Record<AppLanguage, string>> = { en: 'English', es: 'Español' };

@Component({
  selector: 'ichu-language-menu',
  imports: [MatButtonModule, MatMenuModule, TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button mat-button type="button" class="language-trigger" [matMenuTriggerFor]="languageMenu"
      [attr.aria-label]="('common.language' | translate) + ': ' + names[language.current()]">
      <span aria-hidden="true">{{ language.current().toUpperCase() }}</span>
      <ichu-icon name="chevron" />
    </button>
    <mat-menu #languageMenu="matMenu" [aria-label]="'common.language' | translate">
      @for (code of languages; track code) {
        <button mat-menu-item type="button" role="menuitemradio" [attr.aria-checked]="code === language.current()" (click)="select(code)">
          <span>{{ names[code] }}</span>
          @if (code === language.current()) { <ichu-icon matMenuItemIcon name="check" /> }
        </button>
      }
    </mat-menu>`,
  styles: ':host{display:inline-flex}.language-trigger{min-height:44px;color:inherit}.language-trigger ichu-icon{width:16px;height:16px}',
})
export class LanguageMenu {
  readonly language = inject(LanguageService);
  readonly languages = SUPPORTED_LANGUAGES;
  readonly names = LANGUAGE_NAMES;

  select(code: AppLanguage): void {
    // A failed load leaves the current language in place; the menu simply stays on it.
    this.language.use(code).catch(() => undefined);
  }
}
