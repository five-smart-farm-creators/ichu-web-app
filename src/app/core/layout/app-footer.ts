import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageMenu } from '../../shared/presentation/language-menu';

/** Footer shared by every page; the language menu appears only where the app toolbar is absent. */
@Component({
  selector: 'ichu-app-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LanguageMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer class="app-footer">
    <span>{{ 'footer.copyright' | translate }}</span>
    <a routerLink="/terms">{{ 'footer.terms' | translate }}</a>
    @if (showLanguageMenu()) { <ichu-language-menu /> }
  </footer>`,
  styles: ':host{display:block;width:100%}.app-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px;box-sizing:border-box;max-width:1060px;margin:0 auto;padding:6px 20px 12px;color:var(--muted);font-size:12px}.app-footer a{display:inline-flex;align-items:center;min-height:44px;color:inherit;text-decoration:none}.app-footer a:hover{text-decoration:underline}',
})
export class AppFooter {
  readonly showLanguageMenu = input(false);
}
