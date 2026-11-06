import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthFacade } from '../../../application/services/auth.facade';
import { Icon } from '../../../../../shared/presentation/icon';
import { EntryTransition } from '../../components/entry-transition';

@Component({
  selector: 'ichu-login-page', standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, RouterLink, Icon, EntryTransition],
  templateUrl: './login-page.html', styleUrls: ['../../login-page.scss', '../../login-form.scss', '../../login-photo.scss', '../../auth-motion.scss', '../../login-responsive.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly credentials = new FormGroup({
    email: new FormControl('', {
      nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(120)],
    }),
    password: new FormControl('', {
      nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });
  readonly entering = signal(false);
  readonly transitioning = signal(false);
  readonly navigationFailed = signal(false);
  readonly passwordVisible = signal(false);
  private destination = '/account';

  async signIn(): Promise<void> {
    this.credentials.markAllAsTouched();
    if (this.credentials.invalid || this.entering()) {
      const target = this.credentials.controls.email.invalid ? 'login-email' : 'login-password';
      document.getElementById(target)?.focus();
      return;
    }
    this.entering.set(true);
    this.navigationFailed.set(false);
    const { email, password } = this.credentials.getRawValue();
    try {
      if (await this.auth.signIn(email, password)) {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/account';
        this.transitioning.set(true);
      }
    } finally {
      this.credentials.controls.password.reset('');
      this.entering.set(false);
    }
  }

  async finishTransition(): Promise<void> {
    if (!this.transitioning()) return;
    try {
      this.navigationFailed.set(!await this.router.navigateByUrl(this.destination));
    } catch {
      this.navigationFailed.set(true);
    } finally {
      this.transitioning.set(false);
    }
  }
}
