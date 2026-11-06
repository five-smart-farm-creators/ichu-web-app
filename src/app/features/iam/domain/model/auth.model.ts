import type { ProfessionalProfile } from './professional-profile.model';

/** A Firebase identity that has passed application-account verification. */


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

/** Ranch scope granted to the current application account. */
export interface RanchAccess {
  readonly ranchId: string;
  readonly scope: string;
  readonly expiresAt: string | null;
}

/** Account details required by the backend registration endpoint. */
export interface RegisterAccountRequest {
  readonly role: 'RanchManager' | 'Veterinarian';
  readonly ranchName?: string;
  readonly region?: string;
  readonly district?: string;
  readonly estimatedHeadCount?: number;
}

/** Token response returned by POST /api/v1/accounts/sessions. */
export interface AuthSession {
  readonly idToken: string;
  readonly tokenType: string;
}

/** Stable error categories exposed by authentication use cases. */
export type AuthErrorCode =
  | 'configuration'
  | 'invalid-credentials'
  | 'email-already-in-use'
  | 'weak-password'
  | 'email-not-verified'
  | 'account-unavailable'
  | 'service-unavailable'
  | 'network'
  | 'unknown';

/** A safe authentication error that never includes submitted credentials. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
