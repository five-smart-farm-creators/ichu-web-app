import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

/** Shows the verified account, its ranch access, and the veterinarian's professional profile. */
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

  /** Copies the access code and reports the result through the polite status line. */
  copyAccessCode(code: string): void {
    this.codeCopied.set(this.clipboard.copy(code));
  }
}
