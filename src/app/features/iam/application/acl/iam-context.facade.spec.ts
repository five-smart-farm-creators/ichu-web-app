import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { IamAccount, RanchAccess } from '../../domain/model/auth.model';
import { AuthFacade } from '../services/auth.facade';
import { IamContextFacade } from './iam-context.facade';

const firstRanchId = 'a1f0c3e2-1111-4a2b-9c3d-000000000001';
const secondRanchId = 'a1f0c3e2-1111-4a2b-9c3d-000000000002';

function ranchAccess(ranchId: string, scope = 'Read'): RanchAccess {
  return { ranchId, scope, expiresAt: null, name: null };
}

describe('IamContextFacade', () => {
  let account: WritableSignal<IamAccount | null>;
  let ranches: WritableSignal<readonly RanchAccess[]>;

  function createFacade(): IamContextFacade {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        IamContextFacade,
        { provide: AuthFacade, useValue: { account, ranchAccess: ranches } },
      ],
    });
    return TestBed.inject(IamContextFacade);
  }

  beforeEach(() => {
    localStorage.clear();
    account = signal<IamAccount | null>({
      id: 'account-1', email: 'manager@example.test', role: 'RanchManager', status: 'Active', profile: null,
    });
    ranches = signal<readonly RanchAccess[]>([ranchAccess(firstRanchId), ranchAccess(secondRanchId, 'Manage')]);
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('defaults to the first authorized ranch', () => {
    expect(createFacade().currentRanchId()).toBe(firstRanchId);
  });

  it('restores a stored choice while the account still has access to it', () => {
    localStorage.setItem('ichu.currentRanch.account-1', secondRanchId);

    expect(createFacade().currentRanchId()).toBe(secondRanchId);
  });

  it('ignores a stored ranch that is no longer accessible', () => {
    localStorage.setItem('ichu.currentRanch.account-1', 'revoked-ranch');

    expect(createFacade().currentRanchId()).toBe(firstRanchId);
  });

  it('persists a selection for the account and rejects ranches outside its access', () => {
    const facade = createFacade();

    facade.selectRanch('not-authorized');
    expect(facade.currentRanchId()).toBe(firstRanchId);

    facade.selectRanch(secondRanchId);
    expect(facade.currentRanchId()).toBe(secondRanchId);
    expect(localStorage.getItem('ichu.currentRanch.account-1')).toBe(secondRanchId);
  });

  it('exposes the role and leaves ranch names empty instead of using the ranch ID', () => {
    const facade = createFacade();

    expect(facade.currentRole()).toBe('RanchManager');
    expect(facade.currentRanch()?.name).toBeNull();
  });
});
