import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { CattleInformationContextFacade } from '../../application/acl/cattle-information-context.facade';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { RestCattleRepository } from '../repositories/rest-cattle.repository';
import { RestLotRepository } from '../repositories/rest-lot.repository';

/** Composes the cattle and lot REST adapters and the ACL facade that other contexts may inject. */
export function provideCattleInformation(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestCattleRepository,
    { provide: CattleRepository, useExisting: RestCattleRepository },
    RestLotRepository,
    { provide: LotRepository, useExisting: RestLotRepository },
    CattleInformationContextFacade,
  ]);
}
