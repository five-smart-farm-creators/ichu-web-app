import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade } from '../../../planning/application/acl/planning-context.facade';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { HerdIndicators, IndicatorValue } from '../../domain/model/herd-indicators.model';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { HerdDashboardFacade, UPCOMING_WORK_DAYS } from './herd-dashboard.facade';

const period: AnalyticsPeriod = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };
const later: AnalyticsPeriod = { from: new Date('2026-11-01T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

function indicator(overrides: Partial<IndicatorValue> = {}): IndicatorValue {
  return { value: 12, unit: 'animals', formula: 'distinct animals with valid period readings', denominator: 14, unavailableReason: null, ...overrides };
}

function indicators(overrides: Partial<HerdIndicators> = {}): HerdIndicators {
  return {
    ranchId: 'ranch-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' }, updatedAt: '2026-11-12T00:00:00Z',
    source: 'ichu-platform', monitoredAnimals: indicator(), openAlertsByType: { temperature: 2 }, alertsUnavailableReason: null,
    outsideGeofenceAnimals: indicator({ value: 1, unit: 'animals' }), mortalityRate: indicator({ value: 0, unit: 'percent' }),
    births: indicator({ value: 3, unit: 'events', denominator: null }), confirmedPregnancies: indicator({ value: null, unit: 'events', denominator: null, unavailableReason: 'Pregnancy observations are unavailable.' }),
    excludedAnimals: 2, missingReadings: null, readingsCoverageReason: 'The expected reading count is unavailable.', ...overrides,
  };
}

describe('HerdDashboardFacade', () => {
  let facade: HerdDashboardFacade;
  let repository: { dashboard: ReturnType<typeof vi.fn> };
  let planning: { upcomingActivities: ReturnType<typeof vi.fn> };
  let cattle: { cattleSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { dashboard: vi.fn(async (): Promise<HerdIndicators> => indicators()) };
    planning = {
      upcomingActivities: vi.fn(async () => [
        { title: 'Vaccinate the herd', scheduledAt: '2026-11-13T08:00:00Z', cattleId: null },
        { title: 'Check the hoof', scheduledAt: '2026-11-14T09:00:00Z', cattleId: 'cattle-2' },
      ]),
    };
    cattle = { cattleSummaries: vi.fn(async () => [{ cattleId: 'cattle-2', earTag: '102', status: 'Active' }]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        HerdDashboardFacade,
        { provide: HerdIndicatorRepository, useValue: repository },
        { provide: PlanningContextFacade, useValue: planning },
        { provide: CattleInformationContextFacade, useValue: cattle },
      ],
    });
    facade = TestBed.inject(HerdDashboardFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the indicators of the period and the work of the next days, with ear tags instead of ids', async () => {
    await facade.open('ranch-1', period);

    expect(repository.dashboard).toHaveBeenCalledWith('ranch-1', period);
    expect(facade.report()?.monitoredAnimals.value).toBe(12);
    expect(planning.upcomingActivities).toHaveBeenCalledWith('ranch-1', UPCOMING_WORK_DAYS);
    expect(facade.upcoming()).toEqual([
      { title: 'Vaccinate the herd', scheduledAt: '2026-11-13T08:00:00Z', earTag: null },
      { title: 'Check the hoof', scheduledAt: '2026-11-14T09:00:00Z', earTag: '102' },
    ]);
  });

  it('reads the indicators again for a new period without reloading the upcoming work', async () => {
    await facade.open('ranch-1', period);
    await facade.setPeriod(later);

    expect(repository.dashboard).toHaveBeenLastCalledWith('ranch-1', later);
    expect(facade.period()).toBe(later);
    expect(planning.upcomingActivities).toHaveBeenCalledTimes(1);
  });

  it('keeps the upcoming work when the indicators fail, and reports the failure on its own', async () => {
    repository.dashboard.mockRejectedValueOnce(new ApiError(503, 'SourceUnavailable', 'Unavailable'));

    await facade.open('ranch-1', period);

    expect(facade.report()).toBeNull();
    expect(facade.error()?.title).toBe('Unavailable');
    expect(facade.upcoming()).toHaveLength(2);
    expect(facade.upcomingError()).toBeNull();
  });

  it('clears the view when no ranch is current', async () => {
    await facade.open(null, period);

    expect(repository.dashboard).not.toHaveBeenCalled();
    expect(facade.report()).toBeNull();
    expect(facade.upcoming()).toEqual([]);
  });
});
