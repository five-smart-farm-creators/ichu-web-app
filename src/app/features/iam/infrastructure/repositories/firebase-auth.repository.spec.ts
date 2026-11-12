import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { AuthError } from '../../domain/model/auth.model';
import { FirebaseAuthRepository } from './firebase-auth.repository';

const mocks = vi.hoisted(() => ({
  currentUser: null as { uid: string; email: string | null; displayName: string | null; emailVerified: boolean } | null,
  credential: vi.fn((email: string, password: string) => ({ providerId: 'password', email, password })),
  getAuth: vi.fn(() => ({ get currentUser() { return mocks.currentUser; } })),
  onAuthStateChanged: vi.fn((_auth: unknown, _next: (user: unknown) => void, _error?: unknown) => () => undefined),
  reauthenticateWithCredential: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'ichu-iam', options: {} })),
}));

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: mocks.credential },
  createUserWithEmailAndPassword: vi.fn(),
  getAuth: mocks.getAuth,
  getIdToken: vi.fn(),
  onAuthStateChanged: mocks.onAuthStateChanged,
  reauthenticateWithCredential: mocks.reauthenticateWithCredential,
  sendEmailVerification: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updatePassword: mocks.updatePassword,
  updateProfile: vi.fn(),
}));

const user = { uid: 'user-1', email: 'manager@example.test', displayName: null, emailVerified: true };
const config = {
  apiBaseUrl: 'https://api.example.test/api/v1',
  firebase: { apiKey: 'example-web-key', authDomain: 'example.test', projectId: 'example-project' },
};

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve));
}

describe('FirebaseAuthRepository', () => {
  let repository: FirebaseAuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser = user;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [FirebaseAuthRepository, { provide: RUNTIME_CONFIG, useValue: config }],
    });
    repository = TestBed.inject(FirebaseAuthRepository);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('changePassword', () => {
    it('verifies the current password before it updates the password', async () => {
      await repository.changePassword('current-example', 'next-example-1');

      expect(mocks.credential).toHaveBeenCalledWith(user.email, 'current-example');
      expect(mocks.reauthenticateWithCredential).toHaveBeenCalledWith(user, expect.objectContaining({ email: user.email }));
      expect(mocks.updatePassword).toHaveBeenCalledWith(user, 'next-example-1');
      expect(mocks.reauthenticateWithCredential.mock.invocationCallOrder[0])
        .toBeLessThan(mocks.updatePassword.mock.invocationCallOrder[0]);
    });

    it('reports a rejected current password and leaves the password unchanged', async () => {
      mocks.reauthenticateWithCredential.mockRejectedValueOnce({ code: 'auth/invalid-credential' });

      const failure = repository.changePassword('wrong-example', 'next-example-1');

      await expect(failure).rejects.toBeInstanceOf(AuthError);
      await expect(failure).rejects.toMatchObject({ code: 'current-password-incorrect' });
      expect(mocks.updatePassword).not.toHaveBeenCalled();
    });

    it('maps the other Firebase failures to the codes the page translates', async () => {
      mocks.updatePassword.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
      await expect(repository.changePassword('current-example', 'next-example-1'))
        .rejects.toMatchObject({ code: 'requires-recent-login' });

      mocks.updatePassword.mockRejectedValueOnce({ code: 'auth/weak-password' });
      await expect(repository.changePassword('current-example', 'short')).rejects.toMatchObject({ code: 'weak-password' });

      mocks.reauthenticateWithCredential.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
      await expect(repository.changePassword('current-example', 'next-example-1'))
        .rejects.toMatchObject({ code: 'service-unavailable' });
    });

    it('refuses to change the password when no identity is signed in', async () => {
      mocks.currentUser = null;

      await expect(repository.changePassword('current-example', 'next-example-1')).rejects.toMatchObject({ code: 'account-unavailable' });
      expect(mocks.reauthenticateWithCredential).not.toHaveBeenCalled();
    });
  });

  describe('observeAuthState and currentUser', () => {
    it('reports no user until the SDK has loaded, then the signed-in user', async () => {
      expect(repository.currentUser()).toBeNull();

      await repository.sendEmailVerification();

      expect(repository.currentUser()).toEqual({ uid: 'user-1', email: 'manager@example.test', displayName: null, emailVerified: true });
    });

    it('forwards Firebase user changes to the listener once the SDK has loaded', async () => {
      const listener = vi.fn();
      repository.observeAuthState(listener);

      await vi.waitFor(() => expect(mocks.onAuthStateChanged).toHaveBeenCalledTimes(1), { timeout: 5000 });
      const emitUserChange = mocks.onAuthStateChanged.mock.calls[0][1];
      emitUserChange(user);
      emitUserChange(null);

      expect(listener).toHaveBeenNthCalledWith(1, { uid: 'user-1', email: 'manager@example.test', displayName: null, emailVerified: true });
      expect(listener).toHaveBeenNthCalledWith(2, null);
    });

    it('does not subscribe when the caller stops observing before the SDK has loaded', async () => {
      const stop = repository.observeAuthState(vi.fn());
      stop();

      await vi.waitFor(() => expect(mocks.getAuth).toHaveBeenCalled(), { timeout: 5000 });
      await settle();

      expect(mocks.onAuthStateChanged).not.toHaveBeenCalled();
    });
  });
});
