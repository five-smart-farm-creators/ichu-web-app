/** A backend advisory request or ranch-access decision. */
export interface HerdAdvisoryRecord {
  readonly id: string;
  readonly veterinarianId: string;
  readonly ranchId: string;
  readonly reason: string;
  readonly status: string;
  readonly scope: AccessScope;
  readonly requestedAt: string;
  readonly grantedAt: string | null;
  readonly expiresAt: string | null;
  readonly endedAt: string | null;
  readonly veterinarianProfile: {
    readonly specialty: string;
    readonly licenseNumber: string;
    readonly yearsOfExperience: number;
  } | null;
}

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
