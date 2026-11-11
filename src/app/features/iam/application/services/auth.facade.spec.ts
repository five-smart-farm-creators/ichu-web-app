import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthError, type AuthUser, type IamAccount, type RanchAccess, type RegisterAccountRequest } from '../../domain/model/auth.model';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { AuthFacade } from './auth.facade';
import { authGuard } from '../guards/auth.guard';

type AuthStateListener = (user: AuthUser | null) => void;

function authUser(email: string, uid = email, emailVerified = true): AuthUser {
  return { uid, email, displayName: null, emailVerified };
}

function iamAccount(email: string): IamAccount {
  return { id: 'account-' + email, email, role: 'Veterinarian', status: 'Active', profile: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleAsyncWork(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('AuthFacade', () => {
  let authentication: ReturnType<typeof makeAuthenticationMock>;
  let accounts: ReturnType<typeof makeAccountMock>;
  let facade: AuthFacade;
  let emitAuthState: (user: AuthUser | null) => void;

  function makeAuthenticationMock() {
    let currentUser: AuthUser | null = null;
    let listener: AuthStateListener | undefined;
    emitAuthState = user => {
      currentUser = user;
      listener?.(user);
    };

    return {
      isConfigured: vi.fn(() => true),
      observeAuthState: vi.fn((next: AuthStateListener) => {
        listener = next;
        next(null);
        return () => undefined;
      }),
      currentUser: vi.fn(() => currentUser),
      signIn: vi.fn(async (email: string, _password: string) => {
        const user = authUser(email);
        emitAuthState(user);
        return user;
      }),
      createUser: vi.fn(async (email: string, _password: string) => {
        const user = authUser(email);
        emitAuthState(user);
        return user;
      }),
      updateDisplayName: vi.fn(async (_name: string) => undefined),
      sendEmailVerification: vi.fn(async () => undefined),
      sendPasswordReset: vi.fn(async (_email: string) => undefined),
      signOut: vi.fn(async () => {
        emitAuthState(null);
      }),
      idToken: vi.fn(async () => 'test-id-token'),
    };
  }

  function makeAccountMock() {
    return {
      isConfigured: vi.fn(() => true),
      registerAccount: vi.fn(async (_request: RegisterAccountRequest) => undefined),
      currentAccount: vi.fn(async () => iamAccount(authentication.currentUser()?.email ?? 'user@example.test')),
      ranchAccess: vi.fn(async (): Promise<readonly RanchAccess[]> => []),
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    authentication = makeAuthenticationMock();
    accounts = makeAccountMock();
    TestBed.configureTestingModule({
      providers: [
        AuthFacade,
        provideRouter([]),
        { provide: AuthenticationRepository, useValue: authentication },
        { provide: AccountRepository, useValue: accounts },
      ],
    });
    facade = TestBed.inject(AuthFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('signs in through Firebase and verifies the ICHU account', async () => {
    expect(await facade.signIn('rancher@example.test', 'correct-password')).toBe(true);

    expect(authentication.signIn).toHaveBeenCalledWith('rancher@example.test', 'correct-password');
    expect(facade.authenticated()).toBe(true);
    expect(facade.account()?.email).toBe('rancher@example.test');
  });

  it('does not sign out an observer user before registration finishes provisioning and verification', async () => {
    const user = authUser('new-user@example.test', 'new-user');
    const createPending = deferred<AuthUser>();
    const events: string[] = [];

    authentication.createUser.mockImplementation((_email, _password) => {
      events.push('create-user-started');
      emitAuthState(user);
      return createPending.promise;
    });
    authentication.updateDisplayName.mockImplementation(async () => {
      events.push('update-display-name');
    });
    accounts.registerAccount.mockImplementation(async () => {
      events.push('register-account');
    });
    authentication.sendEmailVerification.mockImplementation(async () => {
      events.push('send-verification');
    });
    authentication.signOut.mockImplementation(async () => {
      events.push('sign-out');
      emitAuthState(null);
    });

    const registration = facade.register('new-user@example.test', 'password-123', 'New User', { role: 'Veterinarian' });
    await settleAsyncWork();

    expect(authentication.signOut).not.toHaveBeenCalled();
    expect(authentication.updateDisplayName).not.toHaveBeenCalled();
    expect(accounts.registerAccount).not.toHaveBeenCalled();
    expect(authentication.sendEmailVerification).not.toHaveBeenCalled();

    createPending.resolve(user);
    expect(await registration).toBe(true);
    expect(events).toEqual([
      'create-user-started',
      'update-display-name',
      'register-account',
      'send-verification',
      'sign-out',
    ]);
  });

  it('retries a pending duplicate after proving credentials and resends verification without deleting the identity', async () => {
    const email = 'pending-user@example.test';
    const user = authUser(email, 'pending-user', false);
    const deleteIdentity = vi.fn();
    Object.assign(authentication, { deleteUser: deleteIdentity });
    authentication.createUser.mockRejectedValue(new AuthError('email-already-in-use'));
    authentication.signIn.mockImplementation(async (_email, _password) => {
      emitAuthState(user);
      return user;
    });
    accounts.registerAccount.mockRejectedValue(new AuthError('account-unavailable'));
    authentication.sendEmailVerification.mockImplementation(async () => {
      expect(authentication.currentUser()).toEqual(user);
    });

    expect(await facade.register(email, 'correct-password', 'Pending User', { role: 'Veterinarian' })).toBe(true);

    expect(authentication.signIn).toHaveBeenCalledWith(email, 'correct-password');
    expect(accounts.registerAccount).toHaveBeenCalledOnce();
    expect(authentication.sendEmailVerification).toHaveBeenCalledOnce();
    expect(deleteIdentity).not.toHaveBeenCalled();
    expect(authentication.signOut).toHaveBeenCalledOnce();
  });

  it('does not let a stale user failure clear a newer verified user', async () => {
    const userA = authUser('a@example.test', 'user-a');
    const userB = authUser('b@example.test', 'user-b');
    const accountA = deferred<IamAccount>();
    const accountB = deferred<IamAccount>();
    const accessA = deferred<readonly RanchAccess[]>();
    const accessB = deferred<readonly RanchAccess[]>();

    accounts.currentAccount
      .mockImplementationOnce(() => accountA.promise)
      .mockImplementationOnce(() => accountB.promise);
    accounts.ranchAccess
      .mockImplementationOnce(() => accessA.promise)
      .mockImplementationOnce(() => accessB.promise);

    emitAuthState(userA);
    emitAuthState(userB);

    accountB.resolve(iamAccount(userB.email));
    accessB.resolve([]);
    await settleAsyncWork();
    expect(facade.authenticated()).toBe(true);
    expect(facade.currentUser()?.uid).toBe(userB.uid);

    accountA.reject(new Error('stale account request failed'));
    accessA.resolve([]);
    await settleAsyncWork();

    expect(facade.authenticated()).toBe(true);
    expect(facade.currentUser()?.uid).toBe(userB.uid);
    expect(facade.account()?.email).toBe(userB.email);
  });

  it('clears authenticated state immediately when the observer switches users', async () => {
    const userA = authUser('a@example.test', 'user-a');
    const userB = authUser('b@example.test', 'user-b');
    emitAuthState(userA);
    await settleAsyncWork();
    expect(facade.authenticated()).toBe(true);

    const accountB = deferred<IamAccount>();
    const accessB = deferred<readonly RanchAccess[]>();
    accounts.currentAccount.mockImplementationOnce(() => accountB.promise);
    accounts.ranchAccess.mockImplementationOnce(() => accessB.promise);

    emitAuthState(userB);

    expect(facade.authenticated()).toBe(false);
    expect(facade.currentUser()).toBeNull();
    expect(facade.account()).toBeNull();
    expect(facade.loading()).toBe(true);

    accountB.resolve(iamAccount(userB.email));
    accessB.resolve([]);
    await settleAsyncWork();
    expect(facade.authenticated()).toBe(true);
    expect(facade.currentUser()?.uid).toBe(userB.uid);
  });

  it('does not reauthenticate after sign-out while account validation is pending', async () => {
    const user = authUser('signout@example.test', 'signout-user');
    const pendingAccount = deferred<IamAccount>();
    const pendingAccess = deferred<readonly RanchAccess[]>();
    accounts.currentAccount.mockImplementationOnce(() => pendingAccount.promise);
    accounts.ranchAccess.mockImplementationOnce(() => pendingAccess.promise);

    emitAuthState(user);
    expect(facade.loading()).toBe(true);

    await facade.signOut();
    expect(facade.authenticated()).toBe(false);
    expect(facade.currentUser()).toBeNull();

    pendingAccount.resolve(iamAccount(user.email));
    pendingAccess.resolve([]);
    await settleAsyncWork();

    expect(facade.authenticated()).toBe(false);
    expect(facade.currentUser()).toBeNull();
    expect(facade.account()).toBeNull();
  });

  it('fails closed in the guard while account validation or an auth operation is in progress', async () => {
    facade.authenticated.set(true);
    facade.loading.set(true);

    const runGuard = () => TestBed.runInInjectionContext(() => authGuard(
      {} as never,
      { url: '/account' } as RouterStateSnapshot,
    ));

    expect(await runGuard()).toBeInstanceOf(UrlTree);

    facade.loading.set(false);
    facade.busy.set(true);
    expect(await runGuard()).toBeInstanceOf(UrlTree);
  });
});
