import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { PlanningContextFacade } from '../../application/acl/planning-context.facade';
import { PlanningCampaignRepository } from '../../domain/repositories/planning-campaign.repository';
import { PlannedActivityRepository } from '../../domain/repositories/planned-activity.repository';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';
import { RestPlanningCampaignRepository } from '../repositories/rest-planning-campaign.repository';
import { RestPlannedActivityRepository } from '../repositories/rest-planned-activity.repository';
import { RestWithdrawalPeriodRepository } from '../repositories/rest-withdrawal-period.repository';

/** Composes the REST adapters of the planning context and the ACL facade that other contexts may inject. */
export function providePlanning(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestPlanningCampaignRepository,
    { provide: PlanningCampaignRepository, useExisting: RestPlanningCampaignRepository },
    RestPlannedActivityRepository,
    { provide: PlannedActivityRepository, useExisting: RestPlannedActivityRepository },
    RestWithdrawalPeriodRepository,
    { provide: WithdrawalPeriodRepository, useExisting: RestWithdrawalPeriodRepository },
    PlanningContextFacade,
  ]);
}
