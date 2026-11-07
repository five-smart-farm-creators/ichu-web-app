import { Injectable, inject } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { AuthError, type AuthUser } from '../../domain/model/auth.model';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { IAM_CONFIG, IAM_FIREBASE_APP_NAME } from '../configuration/iam-config';

@Injectable()
export class FirebaseAuthRepository extends AuthenticationRepository {
  private readonly config = inject(IAM_CONFIG);
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
      throw new AuthError(
        'configuration',
        'Firebase Authentication is not configured. Add Firebase runtime settings to enable sign-in.',
      );
    }
    let app: FirebaseApp;
    if (getApps().some(candidate => candidate.name === IAM_FIREBASE_APP_NAME)) {
      app = getApp(IAM_FIREBASE_APP_NAME);
      if (app.options.projectId !== options.projectId || app.options.apiKey !== options.apiKey) {
        throw new AuthError('configuration', 'The existing Firebase app does not match the IAM configuration.');
      }
    } else {
      app = initializeApp(options, IAM_FIREBASE_APP_NAME);
    }
    this.authClient = getAuth(app);
    return this.authClient;
  }

  private requireCurrentUser(): User {
    const user = this.auth().currentUser;
    if (!user) throw new AuthError('account-unavailable', 'There is no signed-in Firebase user.');
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
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code).replace(/^auth\//, '') : '';
    if (code === 'email-already-in-use') return new AuthError('email-already-in-use', 'An account already uses this email address.');
    if (code === 'weak-password' || code === 'password-does-not-meet-requirements') {
      return new AuthError('weak-password', 'Choose a stronger password and try again.');
    }
    if (code === 'invalid-credential' || code === 'user-not-found' || code === 'wrong-password' || code === 'invalid-email') {
      return new AuthError('invalid-credentials', 'The email or password is incorrect.');
    }
    if (code === 'network-request-failed' || code === 'timeout') {
      return new AuthError('network', 'The authentication service could not be reached. Check your connection and try again.');
    }
    if (code === 'too-many-requests') {
      return new AuthError('service-unavailable', 'Too many attempts were made. Wait a moment and try again.');
    }
    return new AuthError('unknown', 'Authentication could not be completed. Try again.');
  }
}
