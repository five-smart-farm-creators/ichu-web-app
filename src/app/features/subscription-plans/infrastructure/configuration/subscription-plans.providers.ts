import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { PlansFacade } from '../../application/services/plans.facade';
import { SubscriptionFacade } from '../../application/services/subscription.facade';
import { CheckoutLocation } from '../../domain/repositories/checkout-location';
import { PlanRepository } from '../../domain/repositories/plan.repository';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';
import { BrowserCheckoutLocation } from '../repositories/browser-checkout-location';
import { RestPlanRepository } from '../repositories/rest-plan.repository';
import { RestSubscriptionRepository } from '../repositories/rest-subscription.repository';

/** Composes the catalog and subscription adapters, the browser redirect, and the facades that the plan pages share. */
export function provideSubscriptionPlans(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestPlanRepository,
    { provide: PlanRepository, useExisting: RestPlanRepository },
    RestSubscriptionRepository,
    { provide: SubscriptionRepository, useExisting: RestSubscriptionRepository },
    BrowserCheckoutLocation,
    { provide: CheckoutLocation, useExisting: BrowserCheckoutLocation },
    PlansFacade,
    SubscriptionFacade,
  ]);
}
