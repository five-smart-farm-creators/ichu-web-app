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

/** Input accepted by POST /api/v1/herd-advisories. */
export interface RequestHerdAdvisory {
  readonly ranchId: string;
  readonly reason: string;
}

/** Input accepted by PATCH /api/v1/herd-advisories/{id}. */
export interface DecideHerdAdvisory {
  readonly decision: 'grant' | 'reject' | 'revoke';
  readonly scope?: AccessScope;
  readonly expiresAt?: string;
}

/** Input accepted by POST /api/v1/herd-advisories/grants. */
export interface GrantHerdAdvisory {
  readonly ranchId: string;
  readonly veterinarianId: string;
  readonly scope: AccessScope;
  readonly expiresAt: string;
}
