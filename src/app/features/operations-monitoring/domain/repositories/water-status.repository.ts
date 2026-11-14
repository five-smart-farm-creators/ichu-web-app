import type { WaterReadingPeriod, WaterReadingsPage, WaterTroughStatus } from '../model/water-status.model';

/** Reads the water trough statuses of a ranch and the readings of a water controller. */
export abstract class WaterStatusRepository {
  abstract troughStatuses(ranchId: string): Promise<readonly WaterTroughStatus[]>;
  abstract readings(
    controllerId: string,
    period: WaterReadingPeriod,
    page: number,
    pageSize: number,
  ): Promise<WaterReadingsPage>;
}
