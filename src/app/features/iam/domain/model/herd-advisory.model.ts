import type { ProfessionalProfile } from './professional-profile.model';

/** A backend advisory request or ranch-access decision. */
export interface HerdAdvisoryRecord {
  readonly id: string;
  readonly veterinarianId: string;
  readonly ranchId: string;
  readonly reason: string;
  readonly status: AdvisoryStatus;
  readonly scope: AccessScope;
  readonly requestedAt: string;
  readonly grantedAt: string | null;
  readonly expiresAt: string | null;
  readonly endedAt: string | null;
  readonly veterinarianProfile: ProfessionalProfile | null;
}

export type AdvisoryStatus = 'Pending' | 'Granted' | 'Rejected' | 'Revoked' | 'Expired';

export type AccessScope = 'Read' | 'ClinicalWrite' | 'Manage';

/** Body accepted by POST ranches/{ranchId}/herd-advisories. */
export interface RequestHerdAdvisory {
  readonly reason: string;
}

/** Body accepted by PATCH ranches/{ranchId}/herd-advisories/{advisoryId}. */
export interface DecideHerdAdvisory {
  readonly decision: 'grant' | 'reject' | 'revoke';
  readonly scope?: AccessScope;
  readonly expiresAt?: string;
}
