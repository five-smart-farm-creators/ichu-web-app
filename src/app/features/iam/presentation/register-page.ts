import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, Injector, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthFacade } from '../application/services/auth.facade';
import { type RegisterAccountRequest } from '../domain/model/auth.model';
import { Icon } from '../../../shared/presentation/icon';
import { AccountAccessFrame } from './account-access-frame';

@Component({
  selector: 'ichu-register-page', standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, RouterLink, Icon, AccountAccessFrame],
  templateUrl: './register-page.html', styleUrls: ['./login-form.scss', './account-forms.scss', './auth-register-review.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  readonly auth = inject(AuthFacade);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [
      Validators.required, Validators.minLength(2), Validators.maxLength(80),
      Validators.pattern(/^(?=.{2,80}$)\S(?:.*\S)?$/),
    ] }),
    email: new FormControl('', { nonNullable: true, validators: [
      Validators.required, Validators.email, Validators.maxLength(120),
    ] }),
    password: new FormControl('', { nonNullable: true, validators: [
      Validators.required, Validators.minLength(8), Validators.maxLength(128),
    ] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    role: new FormControl<'rancher' | 'veterinarian'>('rancher', { nonNullable: true }),
    ranchName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    region: new FormControl('', { nonNullable: true }),
    district: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    estimatedHeadCount: new FormControl(0, { nonNullable: true, validators: [Validators.min(1), Validators.max(1000000)] }),
    terms: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  }, { validators: registrationFormRules });
  readonly reviewing = signal(false);
  readonly entering = signal(false);
  readonly registrationComplete = signal(false);

  review(registrationForm: HTMLFormElement): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const selector = this.form.hasError('passwordMismatch')
        ? '#register-confirm-password'
        : this.form.hasError('ranchDetailsRequired') ? '#register-ranch-name' : 'input.ng-invalid, select.ng-invalid';
      registrationForm.querySelector<HTMLElement>(selector)?.focus();
      return;
    }
    this.reviewing.set(true);
    this.focusAfterRender('#review-title');
  }

  editDetails(): void {
    this.reviewing.set(false);
    this.focusAfterRender('#register-name');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }

  async confirm(): Promise<void> {
    if (this.form.invalid || !this.reviewing() || this.entering()) return;
    this.entering.set(true);
    const values = this.form.getRawValue();
    const request: RegisterAccountRequest = values.role === 'rancher'
      ? {
        role: 'RanchManager', ranchName: values.ranchName.trim(), region: values.region,
        district: values.district.trim(), estimatedHeadCount: values.estimatedHeadCount,
      }
      : { role: 'Veterinarian' };
    try {
      if (await this.auth.register(values.email, values.password, values.name, request)) {
        this.registrationComplete.set(true);
        this.form.controls.password.reset('');
        this.form.controls.confirmPassword.reset('');
        this.focusAfterRender('#registration-success-title');
      }
    } finally {
      this.entering.set(false);
    }
  }
}

function registrationFormRules(control: AbstractControl): ValidationErrors | null {
  const passwordMismatch = control.get('password')?.value !== control.get('confirmPassword')?.value;
  const ranchDetailsRequired = control.get('role')?.value === 'rancher'
    && (!String(control.get('ranchName')?.value ?? '').trim()
      || !String(control.get('region')?.value ?? '').trim()
      || !String(control.get('district')?.value ?? '').trim()
      || !Number.isInteger(Number(control.get('estimatedHeadCount')?.value))
      || Number(control.get('estimatedHeadCount')?.value) < 1);
  if (!passwordMismatch && !ranchDetailsRequired) return null;
  return { ...(passwordMismatch ? { passwordMismatch: true } : {}), ...(ranchDetailsRequired ? { ranchDetailsRequired: true } : {}) };
}
