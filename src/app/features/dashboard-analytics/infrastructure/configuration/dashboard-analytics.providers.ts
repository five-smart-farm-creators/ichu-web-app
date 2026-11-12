import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DashboardAnalyticsContextFacade } from '../../application/acl/dashboard-analytics-context.facade';
import { EpidemiologicalCurveRepository } from '../../domain/repositories/epidemiological-curve.repository';
import { ExecutiveReportRepository } from '../../domain/repositories/executive-report.repository';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { RanchPortfolioRepository } from '../../domain/repositories/ranch-portfolio.repository';
import { RestEpidemiologicalCurveRepository } from '../repositories/rest-epidemiological-curve.repository';
import { RestExecutiveReportRepository } from '../repositories/rest-executive-report.repository';
import { RestHerdIndicatorRepository } from '../repositories/rest-herd-indicator.repository';
import { RestLotTrendRepository } from '../repositories/rest-lot-trend.repository';
import { RestRanchPortfolioRepository } from '../repositories/rest-ranch-portfolio.repository';

/** Composes the REST adapters of the dashboard and analytics context for its lazy route groups. */
export function provideDashboardAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestHerdIndicatorRepository,
    { provide: HerdIndicatorRepository, useExisting: RestHerdIndicatorRepository },
    RestLotTrendRepository,
    { provide: LotTrendRepository, useExisting: RestLotTrendRepository },
    RestEpidemiologicalCurveRepository,
    { provide: EpidemiologicalCurveRepository, useExisting: RestEpidemiologicalCurveRepository },
    RestExecutiveReportRepository,
    { provide: ExecutiveReportRepository, useExisting: RestExecutiveReportRepository },
    RestRanchPortfolioRepository,
    { provide: RanchPortfolioRepository, useExisting: RestRanchPortfolioRepository },
    DashboardAnalyticsContextFacade,
  ]);
}
