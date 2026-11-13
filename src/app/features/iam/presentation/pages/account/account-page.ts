import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { IamContextFacade } from '../../../application/acl/iam-context.facade';
import { AccountFacade } from '../../../application/services/account.facade';
import { AuthFacade } from '../../../application/services/auth.facade';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import { ranchPlace, roleLabelKey, scopeLabelKey, statusLabelKey } from '../../iam-labels';
import { ErrorMessagePipe } from '../../pipes/error-message.pipe';

/** Shows the verified account, its ranch access, the veterinarian's professional profile, and the password change. */
@Component({
  selector: 'ichu-account-page',
  imports: [
    LocalizedDatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslatePipe,
    ErrorMessagePipe,
  ],
  providers: [AccountFacade],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  readonly auth = inject(AuthFacade);
  readonly context = inject(IamContextFacade);
  readonly facade = inject(AccountFacade);
  private readonly clipboard = inject(Clipboard);
  readonly codeCopied = signal(false);
  readonly roleLabelKey = roleLabelKey;
  readonly scopeLabelKey = scopeLabelKey;
  readonly statusLabelKey = statusLabelKey;
  readonly ranchPlace = ranchPlace;

  readonly profileForm = new FormGroup({
    specialty: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)],
    }),
    licenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)],
    }),
    yearsOfExperience: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0), Validators.max(70), Validators.pattern(/^\d+$/)],
    }),
  });

  readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: passwordsMatch });

  constructor() {
    const profile = this.auth.account()?.profile;
    if (profile) this.profileForm.patchValue(profile);
  }

  /** Saves only validated profile fields; the facade replaces the session account on success. */
  async saveProfessionalProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const values = this.profileForm.getRawValue();
    await this.facade.saveProfessionalProfile({
      specialty: values.specialty.trim(),
      licenseNumber: values.licenseNumber.trim(),
      yearsOfExperience: Number(values.yearsOfExperience),
    });
  }

  /** Clears the password fields as soon as they are read, so the passwords do not stay on the page after the submit. */
  async changePassword(): Promise<void> {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.passwordForm.reset();
    await this.facade.changePassword(currentPassword, newPassword);
  }

  /** Copies the access code and reports the result through the polite status line. */
  copyAccessCode(code: string): void {
    this.codeCopied.set(this.clipboard.copy(code));
  }
}

/** The confirmation must repeat the new password exactly; the error sits on the group so the confirmation field is not flagged before it is touched. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('newPassword')?.value === group.get('confirmPassword')?.value ? null : { passwordMismatch: true };
}
