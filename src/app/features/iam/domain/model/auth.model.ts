import type { ProfessionalProfile } from './professional-profile.model';

/** The Firebase identity as the application sees it, without SDK types. */
export interface AuthUser {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
}

/** The application account returned by the IAM REST API. */
export interface IamAccount {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly profile: ProfessionalProfile | null;
}

/** Ranch access for the current account; `accessCode` arrives only with Manage scope. */
export interface RanchAccess {
  readonly ranchId: string;
  readonly scope: string;
  readonly expiresAt: string | null;
  readonly name: string | null;
  readonly region: string | null;
  readonly district: string | null;
  readonly accessCode: string | null;
}

/** Account details required by the backend registration endpoint. */
export interface RegisterAccountRequest {
  readonly role: 'RanchManager' | 'Veterinarian';
  readonly ranchName?: string;
  readonly region?: string;
  readonly district?: string;
  readonly estimatedHeadCount?: number;
}

/** Stable error categories exposed by authentication use cases. */
export type AuthErrorCode =
  | 'configuration'
  | 'invalid-credentials'
  | 'current-password-incorrect'
  | 'requires-recent-login'
  | 'email-already-in-use'
  | 'weak-password'
  | 'email-not-verified'
  | 'account-unavailable'
  | 'service-unavailable'
  | 'network'
  | 'unknown';

/** A safe authentication error that carries only a code; presentation chooses the wording. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}
