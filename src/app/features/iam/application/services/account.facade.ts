import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { AuthError } from '../../domain/model/auth.model';
import type { CompleteProfessionalProfile } from '../../domain/model/professional-profile.model';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { AuthFacade } from './auth.facade';

/** Saves the veterinarian's professional profile; errors and notices are codes that the page translates. */
@Injectable()
export class AccountFacade {
  private readonly authentication = inject(AuthFacade);
  private readonly profiles = inject(ProfessionalProfileRepository);

  readonly busy = signal(false);
  readonly error = signal<ApiError | AuthError | null>(null);
  readonly notice = signal<'profile-saved' | null>(null);

  /** Saves the profile and replaces the session account with the backend response. */
  async saveProfessionalProfile(profile: CompleteProfessionalProfile): Promise<boolean> {
    const account = this.authentication.account();
    if (this.busy()) return false;
    if (account?.role !== 'Veterinarian') {
      this.error.set(new ApiError(403, 'http-403', null));
      return false;
    }
    if (!this.authentication.currentUser()) {
      this.error.set(new AuthError('account-unavailable'));
      return false;
    }

    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const updated = await this.profiles.complete(profile);
      // Sign-out or a switch of account during the request must not receive this response.
      if (this.authentication.account()?.id === account.id) {
        this.authentication.account.set(updated);
      }
      this.notice.set('profile-saved');
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
