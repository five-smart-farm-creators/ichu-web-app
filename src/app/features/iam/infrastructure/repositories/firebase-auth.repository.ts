import { Injectable, inject } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { AuthError, type AuthUser } from '../../domain/model/auth.model';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';

const IAM_FIREBASE_APP_NAME = 'ichu-iam';

type AppSdk = typeof import('firebase/app');
type AuthSdk = typeof import('firebase/auth');

/** The Firebase entry points, downloaded together on first use so the SDK stays out of the initial bundle. */
interface FirebaseSdk {
  readonly app: AppSdk;
  readonly auth: AuthSdk;
}

@Injectable()
export class FirebaseAuthRepository extends AuthenticationRepository {
  private readonly config = inject(RUNTIME_CONFIG);
  private sdkLoad: Promise<FirebaseSdk> | null = null;
  private authClient: Auth | null = null;

  override isConfigured(): boolean {
    const options = this.config.firebase;
    return Boolean(options?.apiKey && options.authDomain && options.projectId);
  }

  /** The SDK loads asynchronously, so the returned function must also cancel a subscription that has not started yet. */
  override observeAuthState(
    listener: (user: AuthUser | null) => void,
    onError?: (error: AuthError) => void,
  ): () => void {
    let unsubscribe: (() => void) | null = null;
    let stopped = false;
    void this.session()
      .then(({ sdk, client }) => {
        if (stopped) return;
        unsubscribe = sdk.onAuthStateChanged(
          client,
          user => listener(user ? this.toAuthUser(user) : null),
          error => onError?.(this.toAuthError(error)),
        );
      })
      .catch(error => {
        if (!stopped) onError?.(this.toAuthError(error));
      });
    return () => {
      stopped = true;
      unsubscribe?.();
      unsubscribe = null;
    };
  }

  /** Null until the SDK has loaded; callers wait for the facade's ready state before they read it. */
  override currentUser(): AuthUser | null {
    if (!this.isConfigured()) throw new AuthError('configuration');
    const user = this.authClient?.currentUser;
    return user ? this.toAuthUser(user) : null;
  }

  override async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const { sdk, client } = await this.session();
      const result = await sdk.signInWithEmailAndPassword(client, email, password);
      return this.toAuthUser(result.user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async createUser(email: string, password: string): Promise<AuthUser> {
    try {
      const { sdk, client } = await this.session();
      const result = await sdk.createUserWithEmailAndPassword(client, email, password);
      return this.toAuthUser(result.user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async updateDisplayName(name: string): Promise<void> {
    const { sdk, user } = await this.requireCurrentUser();
    try {
      await sdk.updateProfile(user, { displayName: name });
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  /** Verifies the current password first, because updatePassword alone would accept any signed-in session. */
  override async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { sdk, user } = await this.requireCurrentUser();
    if (!user.email) throw new AuthError('account-unavailable');
    try {
      await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, currentPassword));
    } catch (error) {
      const code = firebaseErrorCode(error);
      throw code === 'wrong-password' || code === 'invalid-credential'
        ? new AuthError('current-password-incorrect')
        : this.toAuthError(error);
    }
    try {
      await sdk.updatePassword(user, newPassword);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async sendEmailVerification(): Promise<void> {
    const { sdk, user } = await this.requireCurrentUser();
    try {
      await sdk.sendEmailVerification(user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async sendPasswordReset(email: string): Promise<void> {
    try {
      const { sdk, client } = await this.session();
      await sdk.sendPasswordResetEmail(client, email);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async signOut(): Promise<void> {
    try {
      const { sdk, client } = await this.session();
      await sdk.signOut(client);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async idToken(): Promise<string> {
    const { sdk, user } = await this.requireCurrentUser();
    try {
      return await sdk.getIdToken(user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  /** A failed download clears the cache so the next call retries it. */
  private loadSdk(): Promise<FirebaseSdk> {
    this.sdkLoad ??= Promise.all([import('firebase/app'), import('firebase/auth')])
      .then(([app, auth]) => ({ app, auth }))
      .catch(error => {
        this.sdkLoad = null;
        throw this.toAuthError(error);
      });
    return this.sdkLoad;
  }

  /** Configuration is checked before the SDK downloads, so a misconfigured app never fetches it. */
  private async session(): Promise<{ readonly sdk: AuthSdk; readonly client: Auth }> {
    const options = this.config.firebase;
    if (!options?.apiKey || !options.authDomain || !options.projectId) throw new AuthError('configuration');
    const loaded = await this.loadSdk();
    this.authClient ??= iamAuthClient(loaded, options);
    return { sdk: loaded.auth, client: this.authClient };
  }

  private async requireCurrentUser(): Promise<{ readonly sdk: AuthSdk; readonly user: User }> {
    const { sdk, client } = await this.session();
    const user = client.currentUser;
    if (!user) throw new AuthError('account-unavailable');
    return { sdk, user };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    };
  }

  private toAuthError(error: unknown): AuthError {
    if (error instanceof AuthError) return error;
    const code = firebaseErrorCode(error);
    if (code === 'email-already-in-use') return new AuthError('email-already-in-use');
    if (code === 'weak-password' || code === 'password-does-not-meet-requirements') return new AuthError('weak-password');
    if (code === 'invalid-credential' || code === 'user-not-found' || code === 'wrong-password' || code === 'invalid-email') {
      return new AuthError('invalid-credentials');
    }
    if (code === 'network-request-failed' || code === 'timeout') return new AuthError('network');
    if (code === 'too-many-requests') return new AuthError('service-unavailable');
    if (code === 'requires-recent-login') return new AuthError('requires-recent-login');
    return new AuthError('unknown');
  }
}

/** Reuses the IAM app when it already exists, because initializing a second app with the same name throws. */
function iamAuthClient({ app, auth }: FirebaseSdk, options: FirebaseOptions): Auth {
  if (!app.getApps().some(candidate => candidate.name === IAM_FIREBASE_APP_NAME)) {
    return auth.getAuth(app.initializeApp(options, IAM_FIREBASE_APP_NAME));
  }
  const existing = app.getApp(IAM_FIREBASE_APP_NAME);
  if (existing.options.projectId !== options.projectId || existing.options.apiKey !== options.apiKey) {
    throw new AuthError('configuration');
  }
  return auth.getAuth(existing);
}

/** Firebase codes arrive as `auth/<code>`; the prefix is dropped so each mapping compares plain words. */
function firebaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code).replace(/^auth\//, '') : '';
}
