import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { AuthUser, IamAccount } from '../../domain/model/auth.model';
import type { ProfessionalProfile } from '../../domain/model/professional-profile.model';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { AccountFacade } from './account.facade';
import { AuthFacade } from './auth.facade';

const profile: ProfessionalProfile = { specialty: 'Bovine medicine', licenseNumber: 'CMVP-1234', yearsOfExperience: 8 };
const authUser: AuthUser = { uid: 'user-1', email: 'vet@example.test', displayName: null, emailVerified: true };

function account(role: string, professional: ProfessionalProfile | null = null): IamAccount {
  return { id: 'account-1', email: 'vet@example.test', role, status: 'Active', profile: professional };
}

describe('AccountFacade', () => {
  let auth: { account: WritableSignal<IamAccount | null>; currentUser: WritableSignal<AuthUser | null> };
  let complete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    auth = {
      account: signal<IamAccount | null>(account('Veterinarian')),
      currentUser: signal<AuthUser | null>(authUser),
    };
    complete = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        AccountFacade,
        { provide: AuthFacade, useValue: auth },
        { provide: ProfessionalProfileRepository, useValue: { current: vi.fn(), complete } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('replaces the session account with the profile the backend saved', async () => {
    const saved = account('Veterinarian', profile);
    complete.mockResolvedValue(saved);
    const facade = TestBed.inject(AccountFacade);

    expect(await facade.saveProfessionalProfile(profile)).toBe(true);

    expect(complete).toHaveBeenCalledWith(profile);
    expect(auth.account()).toEqual(saved);
    expect(facade.notice()).toBe('profile-saved');
    expect(facade.busy()).toBe(false);
  });

  it('keeps the current account when the backend rejects the profile', async () => {
    complete.mockRejectedValue(new ApiError(400, 'invalid-profile', 'Specialty is required.'));
    const facade = TestBed.inject(AccountFacade);

    expect(await facade.saveProfessionalProfile(profile)).toBe(false);

    expect(auth.account()).toEqual(account('Veterinarian'));
    expect(facade.error()).toMatchObject({ status: 400, title: 'Specialty is required.' });
  });

  it('lets only veterinarians save a professional profile', async () => {
    auth.account.set(account('RanchManager'));
    const facade = TestBed.inject(AccountFacade);

    expect(await facade.saveProfessionalProfile(profile)).toBe(false);

    expect(complete).not.toHaveBeenCalled();
    expect(facade.error()).toMatchObject({ status: 403, code: 'http-403' });
  });
});
