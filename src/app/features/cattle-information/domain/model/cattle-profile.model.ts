import type { Cattle } from './cattle.model';

/** Collar status reported by the IoT assets context; `collarId` is never shown to users. */
export interface CattleDeviceStatus {
  readonly isAvailable: boolean;
  readonly collarId: string | null;
  readonly lastReadingReceivedAt: string | null;
}

/** An animal with its collar status, as the profile endpoint returns them. */
export interface CattleProfile {
  readonly cattle: Cattle;
  readonly device: CattleDeviceStatus;
}
