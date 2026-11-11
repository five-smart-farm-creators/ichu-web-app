import { inject, Injectable } from '@angular/core';
import type { CattleStatus } from '../../domain/model/cattle.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { readAllCattle } from '../services/read-all-cattle';

/** The only animal data other contexts receive: identity, ear tag and status. */
export interface CattleSummary {
  readonly cattleId: string;
  readonly earTag: string;
  readonly status: CattleStatus;
}

/** The only lot data other contexts receive: identity and name, for labelling. */
export interface LotSummary {
  readonly lotId: string;
  readonly name: string;
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
}
