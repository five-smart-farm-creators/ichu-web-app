import { Injectable, inject } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { AuthError, type AuthUser } from '../../domain/model/auth.model';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';

const IAM_FIREBASE_APP_NAME = 'ichu-iam';

@Injectable()
export class FirebaseAuthRepository extends AuthenticationRepository {
  private readonly config = inject(RUNTIME_CONFIG);
  private authClient: Auth | null = null;

  override isConfigured(): boolean {
    const options = this.config.firebase;
    return Boolean(options?.apiKey && options.authDomain && options.projectId);
  }

  override observeAuthState(
    listener: (user: AuthUser | null) => void,
    onError?: (error: AuthError) => void,
  ): () => void {
    return onAuthStateChanged(
      this.auth(),
      user => listener(user ? this.toAuthUser(user) : null),
      error => onError?.(this.toAuthError(error)),
    );
  }

  override currentUser(): AuthUser | null {
    const user = this.auth().currentUser;
    return user ? this.toAuthUser(user) : null;
  }

  override async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const result = await signInWithEmailAndPassword(this.auth(), email, password);
      return this.toAuthUser(result.user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async createUser(email: string, password: string): Promise<AuthUser> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth(), email, password);
      return this.toAuthUser(result.user);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async updateDisplayName(name: string): Promise<void> {
    const user = this.requireCurrentUser();
    try {
      await updateProfile(user, { displayName: name });
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  /** Verifies the current password first, because updatePassword alone would accept any signed-in session. */
  override async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.requireCurrentUser();
    if (!user.email) throw new AuthError('account-unavailable');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    } catch (error) {
      const code = firebaseErrorCode(error);
      throw code === 'wrong-password' || code === 'invalid-credential'
        ? new AuthError('current-password-incorrect')
        : this.toAuthError(error);
    }
    try {
      await updatePassword(user, newPassword);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async sendEmailVerification(): Promise<void> {
    try {
      await sendEmailVerification(this.requireCurrentUser());
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth(), email);
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async signOut(): Promise<void> {
    try {
      await signOut(this.auth());
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  override async idToken(): Promise<string> {
    try {
      return await getIdToken(this.requireCurrentUser());
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  private auth(): Auth {
    if (this.authClient) return this.authClient;
    const options = this.config.firebase;
    if (!options?.apiKey || !options.authDomain || !options.projectId) {
      throw new AuthError('configuration');
    }
    let app: FirebaseApp;
    if (getApps().some(candidate => candidate.name === IAM_FIREBASE_APP_NAME)) {
      app = getApp(IAM_FIREBASE_APP_NAME);
      if (app.options.projectId !== options.projectId || app.options.apiKey !== options.apiKey) {
        throw new AuthError('configuration');
      }
    } else {
      app = initializeApp(options, IAM_FIREBASE_APP_NAME);
    }
    this.authClient = getAuth(app);
    return this.authClient;
  }

  private requireCurrentUser(): User {
    const user = this.auth().currentUser;
    if (!user) throw new AuthError('account-unavailable');
    return user;
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

/** Firebase codes arrive as `auth/<code>`; the prefix is dropped so each mapping compares plain words. */
function firebaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code).replace(/^auth\//, '') : '';
}
