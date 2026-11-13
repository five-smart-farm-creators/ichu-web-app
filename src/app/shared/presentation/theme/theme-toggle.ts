import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon';
import { ThemeService } from './theme.service';

/** Sun and moon button that switches the theme; its label names the theme it switches to. */
@Component({
  selector: 'ichu-theme-toggle',
  imports: [MatButtonModule, TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button mat-icon-button type="button" class="theme-toggle"
      [attr.aria-label]="(isDark() ? 'common.useLightTheme' : 'common.useDarkTheme') | translate" (click)="theme.toggle()">
      <ichu-icon [name]="isDark() ? 'sun' : 'moon'" />
    </button>`,
  styles: ':host{display:inline-flex}.theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px}',
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
  readonly isDark = computed(() => this.theme.current() === 'dark');
}
