import type { ChangeLifeStage, Cattle, CattleFilter, RecordExit, RegisterCattle, UpdateCattle } from '../model/cattle.model';
import type { CattleProfile } from '../model/cattle-profile.model';

/** Defines animal operations backed by the cattle REST API; every call is scoped to one ranch. */
export abstract class CattleRepository {
  abstract list(ranchId: string, filter: CattleFilter, page: number, pageSize: number): Promise<readonly Cattle[]>;
  abstract profile(ranchId: string, cattleId: string): Promise<CattleProfile>;
  abstract register(ranchId: string, request: RegisterCattle): Promise<Cattle>;
  abstract update(ranchId: string, cattleId: string, request: UpdateCattle): Promise<Cattle>;
  abstract changeLifeStage(ranchId: string, cattleId: string, request: ChangeLifeStage): Promise<Cattle>;
  abstract recordExit(ranchId: string, cattleId: string, request: RecordExit): Promise<Cattle>;
}
