import { inject, Injectable } from '@angular/core';
import type { Cattle, CattleFilter, CattleSex, CattleStatus } from '../../domain/model/cattle.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { readAllCattle } from '../services/read-all-cattle';

/** The only animal data other contexts receive: identity, ear tag and status. */
export interface CattleSummary {
  readonly cattleId: string;
  readonly earTag: string;
  readonly status: CattleStatus;
}

/** Animal data monitoring needs: the summary plus the productive stage, which selects the thresholds, and the sex, which decides reproductive records. */
export interface MonitoredCattleSummary extends CattleSummary {
  readonly lifeStage: string;
  readonly sex: CattleSex;
}

/** The only lot data other contexts receive: identity and name, for labelling. */
export interface LotSummary {
  readonly lotId: string;
  readonly name: string;
}

/** A lot with the identities of its animals, so a view can find the lot of one animal. */
export interface LotMembersSummary extends LotSummary {
  readonly cattleIds: readonly string[];
}

/** Publishes animal and lot identities to other bounded contexts, which never import this context's models. */
@Injectable()
export class CattleInformationContextFacade {
  private readonly cattleRepository = inject(CattleRepository);
  private readonly lotRepository = inject(LotRepository);

  /** Lists every animal of the ranch, active and inactive, so past assignments can still be labelled. */
  async cattleSummaries(ranchId: string): Promise<readonly CattleSummary[]> {
    const animals = await readAllCattle(this.cattleRepository, ranchId, {}, Number.POSITIVE_INFINITY);
    return animals.map(animal => ({ cattleId: animal.id, earTag: animal.earTag, status: animal.status }));
  }

  /** Lists the ranch's lots so other contexts can name the lot a resource belongs to. */
  async lotSummaries(ranchId: string): Promise<readonly LotSummary[]> {
    const lots = await this.lotRepository.list(ranchId);
    return lots.map(lot => ({ lotId: lot.id, name: lot.name }));
  }

  /** Lists each lot with its animals, inactive ones included, so a view can open the lot an animal belongs to. */
  async lotMembers(ranchId: string): Promise<readonly LotMembersSummary[]> {
    const lots = await this.lotRepository.list(ranchId);
    return lots.map(lot => ({
      lotId: lot.id,
      name: lot.name,
      cattleIds: lot.memberships.map(membership => membership.cattleId),
    }));
  }

  /** Lists animals for monitoring; the filters narrow the list at the API and `limit` bounds how many animals are read. */
  async monitoredCattle(
    ranchId: string,
    scope: { readonly activeOnly: boolean; readonly lotId?: string | null },
    limit: number,
  ): Promise<readonly MonitoredCattleSummary[]> {
    const filter: CattleFilter = {
      ...(scope.activeOnly ? { status: 'Active' as const } : {}),
      ...(scope.lotId ? { lotId: scope.lotId } : {}),
    };
    const animals = await readAllCattle(this.cattleRepository, ranchId, filter, limit);
    return animals.map(toMonitoredSummary);
  }

  /** Reads one animal's identity, ear tag, status and productive stage without its collar or history. */
  async monitoredCattleById(ranchId: string, cattleId: string): Promise<MonitoredCattleSummary> {
    const profile = await this.cattleRepository.profile(ranchId, cattleId);
    return toMonitoredSummary(profile.cattle);
  }
}

function toMonitoredSummary(animal: Cattle): MonitoredCattleSummary {
  return {
    cattleId: animal.id, earTag: animal.earTag, status: animal.status, lifeStage: animal.currentStage, sex: animal.sex,
  };
}
