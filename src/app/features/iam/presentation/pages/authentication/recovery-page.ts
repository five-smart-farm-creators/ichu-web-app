import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthFacade } from '../../../application/services/auth.facade';
import { Icon } from '../../../../../shared/presentation/icon';
import { AccountAccessFrame } from '../../components/account-access-frame';
import { ErrorMessagePipe } from '../../pipes/error-message.pipe';

@Component({
  selector: 'ichu-recovery-page', standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, RouterLink, Icon, AccountAccessFrame, TranslatePipe, ErrorMessagePipe],
  templateUrl: './recovery-page.html', styleUrls: ['../../styles/auth-controls.scss', '../../styles/auth-motion.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryPage {
  readonly auth = inject(AuthFacade);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [
      Validators.required, Validators.email, Validators.maxLength(120),
    ] }),
  });
  readonly instructionsVisible = signal(false);

  async sendInstructions(): Promise<void> {
    this.form.markAllAsTouched();
    this.instructionsVisible.set(false);
    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLInputElement>('#recovery-email')?.focus();
      return;
    }
    this.instructionsVisible.set(await this.auth.sendPasswordReset(this.form.controls.email.value));
  }
}
