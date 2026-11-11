import { inject, Injectable } from '@angular/core';
import type { CattleStatus } from '../../domain/model/cattle.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { readAllCattle } from '../services/read-all-cattle';

/** The only animal data other contexts receive: identity, ear tag and status. */
export interface CattleSummary {
  readonly cattleId: string;
  readonly earTag: string;
  readonly status: CattleStatus;
}

/** Publishes animal identities to other bounded contexts, which never import this context's models. */
@Injectable()
export class CattleInformationContextFacade {
  private readonly cattleRepository = inject(CattleRepository);

  /** Lists every animal of the ranch, active and inactive, so past assignments can still be labelled. */
  async cattleSummaries(ranchId: string): Promise<readonly CattleSummary[]> {
    const animals = await readAllCattle(this.cattleRepository, ranchId, {}, Number.POSITIVE_INFINITY);
    return animals.map(animal => ({ cattleId: animal.id, earTag: animal.earTag, status: animal.status }));
  }
}
