import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { IamContextFacade } from '../../../features/iam/application/acl/iam-context.facade';
import { AuthFacade } from '../../../features/iam/application/services/auth.facade';
import { Icon } from '../../../shared/presentation/icon';
import { LanguageMenu } from '../../../shared/presentation/language-menu';
import { AppFooter } from '../app-footer';

const ROLE_KEYS: Readonly<Record<string, string>> = {
  RanchManager: 'iam.roles.ranchManager',
  Veterinarian: 'iam.roles.veterinarian',
  FieldOperator: 'iam.roles.fieldOperator',
};

/** Frames authenticated pages with navigation, the ranch context, the language menu, and the account menu. */
@Component({
  selector: 'ichu-app-shell',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    Icon,
    LanguageMenu,
    AppFooter,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  readonly auth = inject(AuthFacade);
  readonly context = inject(IamContextFacade);
  private readonly router = inject(Router);
  /** Side navigation needs room beside the content; narrower screens use an overlay instead. */
  readonly wide = toSignal(
    inject(BreakpointObserver).observe('(min-width: 960px)').pipe(map(state => state.matches)),
    { initialValue: false },
  );
  readonly menuOpen = signal(false);

  roleKey(role: string): string {
    return ROLE_KEYS[role] ?? role;
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
