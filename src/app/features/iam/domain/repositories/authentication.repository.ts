import type { AuthUser } from '../model/auth.model';
import type { AuthError } from '../model/auth.model';

/** Provides framework-independent operations for Firebase email authentication. */
export abstract class AuthenticationRepository {
  abstract isConfigured(): boolean;
  abstract observeAuthState(
    listener: (user: AuthUser | null) => void,
    onError?: (error: AuthError) => void,
  ): () => void;
  abstract currentUser(): AuthUser | null;
  abstract signIn(email: string, password: string): Promise<AuthUser>;
  abstract createUser(email: string, password: string): Promise<AuthUser>;
  abstract updateDisplayName(name: string): Promise<void>;
  abstract changePassword(currentPassword: string, newPassword: string): Promise<void>;
  abstract sendEmailVerification(): Promise<void>;
  abstract sendPasswordReset(email: string): Promise<void>;
  abstract signOut(): Promise<void>;
  abstract idToken(): Promise<string>;
}
