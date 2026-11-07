import { InjectionToken } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';

/** Runtime IAM configuration supplied by the application. */
export interface IamConfig {
  readonly apiBaseUrl: string;
  readonly firebase: FirebaseOptions | null;
}

/** Provides runtime IAM configuration without embedding project credentials. */
export const IAM_CONFIG = new InjectionToken<IamConfig>('IAM_CONFIG', {
  factory: () => ({ apiBaseUrl: '', firebase: null }),
});

export const IAM_FIREBASE_APP_NAME = 'ichu-iam';
