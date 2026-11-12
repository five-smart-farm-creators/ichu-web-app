import type { ReproductiveHistory } from '../model/reproductive-history.model';

/** Reads the breeding history of one animal of a ranch. */
export abstract class ReproductiveHistoryRepository {
  abstract get(ranchId: string, cattleId: string): Promise<ReproductiveHistory>;
}
