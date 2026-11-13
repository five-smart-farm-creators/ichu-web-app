/** Ranch details a veterinarian confirms after an access code matches a ranch. */
export interface RanchSummary {
  readonly ranchId: string;
  readonly name: string | null;
  readonly region: string | null;
  readonly district: string | null;
}
