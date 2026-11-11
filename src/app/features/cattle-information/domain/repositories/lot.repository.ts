import type { CreateLot, Lot } from '../model/lot.model';

/** Defines lot operations backed by the lots REST API; `expectedVersion` is the lot's version. */
export abstract class LotRepository {
  abstract list(ranchId: string): Promise<readonly Lot[]>;
  abstract create(ranchId: string, request: CreateLot): Promise<Lot>;
  abstract assignCattle(ranchId: string, lotId: string, cattleId: string, expectedVersion: string): Promise<Lot>;
  abstract removeCattle(ranchId: string, lotId: string, cattleId: string, expectedVersion: string): Promise<Lot>;
}
