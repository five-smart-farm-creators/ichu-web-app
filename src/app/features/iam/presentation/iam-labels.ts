const ROLE_KEYS: Readonly<Record<string, string>> = {
  RanchManager: 'iam.roles.ranchManager',
  Veterinarian: 'iam.roles.veterinarian',
  FieldOperator: 'iam.roles.fieldOperator',
};

const SCOPE_KEYS: Readonly<Record<string, string>> = {
  Read: 'iam.scope.read',
  ClinicalWrite: 'iam.scope.clinicalWrite',
  Manage: 'iam.scope.manage',
};

// Keyed in lowercase because account and advisory statuses are compared case-insensitively.
const STATUS_KEYS: Readonly<Record<string, string>> = {
  active: 'iam.status.active',
  pending: 'iam.status.pending',
  granted: 'iam.status.granted',
  rejected: 'iam.status.rejected',
  revoked: 'iam.status.revoked',
  expired: 'iam.status.expired',
};

/** Returns the translation key for a backend role; unknown roles stay visible as the backend sent them. */
export function roleLabelKey(role: string): string {
  return ROLE_KEYS[role] ?? role;
}

export function scopeLabelKey(scope: string): string {
  return SCOPE_KEYS[scope] ?? scope;
}

export function statusLabelKey(status: string): string {
  return STATUS_KEYS[status.trim().toLowerCase()] ?? status;
}

/** Maps a status to a badge tone: pending needs attention, granted is safe, ended states are alerts. */
export function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status.trim().toLowerCase()) {
    case 'active':
    case 'granted':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'revoked':
    case 'expired':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Joins a ranch's region and district, skipping whichever is missing. */
export function ranchPlace(ranch: { readonly region: string | null; readonly district: string | null }): string {
  return [ranch.region, ranch.district].filter(Boolean).join(' · ');
}
