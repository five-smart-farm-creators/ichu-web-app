import type { Cattle, CattleFilter } from '../../domain/model/cattle.model';
import type { CattleRepository } from '../../domain/repositories/cattle.repository';

/** The API's largest page; a shorter page is the last one. */
const MAXIMUM_PAGE_SIZE = 100;

/** Reads every page that matches the filter, stopping at `limit` animals so exports stay bounded. */
export async function readAllCattle(
  repository: CattleRepository,
  ranchId: string,
  filter: CattleFilter,
  limit: number,
): Promise<readonly Cattle[]> {
  const rows: Cattle[] = [];
  for (let page = 1; rows.length < limit; page++) {
    const batch = await repository.list(ranchId, filter, page, MAXIMUM_PAGE_SIZE);
    rows.push(...batch.slice(0, limit - rows.length));
    if (batch.length < MAXIMUM_PAGE_SIZE) break;
  }
  return rows;
}
