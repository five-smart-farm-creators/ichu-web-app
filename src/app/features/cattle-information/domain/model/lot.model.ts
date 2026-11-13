export const LOT_NAME_MAX_LENGTH = 80;
export const LOT_CRITERION_MAX_LENGTH = 120;

/** Links an animal to a lot; the animal may be inactive, and its membership stays listed. */
export interface LotMembership {
  readonly cattleId: string;
  readonly assignedAt: string;
}

/** A management group of animals in one ranch; `version` changes with every membership change. */
export interface Lot {
  readonly id: string;
  readonly ranchId: string;
  readonly name: string;
  readonly criterion: string | null;
  readonly version: string;
  readonly memberships: readonly LotMembership[];
}

export interface CreateLot {
  readonly name: string;
  readonly criterion?: string;
}
