import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { DashboardAnalyticsContextFacade } from '../../../dashboard-analytics/application/acl/dashboard-analytics-context.facade';
import type { NutritionPlan, RegisterNutritionPlan } from '../../domain/model/nutrition-plan.model';
import { NutritionPlanRepository } from '../../domain/repositories/nutrition-plan.repository';
import { NutritionFacade } from './nutrition.facade';

function items(kilograms: number): NutritionPlan['items'] {
  return [{ feed: 'Pasture', kind: 'Forage', kilogramsPerHeadPerDay: kilograms }];
}

const earlier: NutritionPlan = {
  id: 'plan-1', lotId: 'lot-1', name: 'Wet season', validFrom: '2026-10-01', validTo: '2026-11-04',
  items: items(10), targetDailyGainKilograms: null, notes: null,
};
const current: NutritionPlan = {
  id: 'plan-2', lotId: 'lot-1', name: 'Dry season', validFrom: '2026-11-05', validTo: null,
  items: items(12), targetDailyGainKilograms: 0.5, notes: null,
};

// Local times keep the days the same on any machine, as the planning calendar reads them.
function reading(at: Date, value: number) {
  return { cattleId: 'cattle-1', recordedAt: at.toISOString(), value };
}

describe('NutritionFacade', () => {
  let facade: NutritionFacade;
  let plans: { list: ReturnType<typeof vi.fn>; current: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn> };
  let cattle: { lotSummaries: ReturnType<typeof vi.fn>; monitoredCattle: ReturnType<typeof vi.fn> };
  let analytics: { lotTrend: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    plans = {
      list: vi.fn(async () => [earlier, current]),
      current: vi.fn(async () => current),
      register: vi.fn(async (_ranchId: string, _lotId: string, request: RegisterNutritionPlan) => ({ ...current, name: request.name })),
    };
    cattle = {
      lotSummaries: vi.fn(async () => [{ lotId: 'lot-2', name: 'Weaned' }, { lotId: 'lot-1', name: 'Heifers' }]),
      monitoredCattle: vi.fn(async () => [{ cattleId: 'cattle-1' }, { cattleId: 'cattle-2' }, { cattleId: 'cattle-3' }]),
    };
    analytics = {
      lotTrend: vi.fn(async () => ({
        points: [
          reading(new Date(2026, 10, 4, 10), 400),
          reading(new Date(2026, 10, 6, 10), 450),
          reading(new Date(2026, 10, 7, 10), 460),
        ],
        unavailableReason: null,
      })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NutritionFacade,
        { provide: NutritionPlanRepository, useValue: plans },
        { provide: CattleInformationContextFacade, useValue: cattle },
        { provide: DashboardAnalyticsContextFacade, useValue: analytics },
      ],
    });
    facade = TestBed.inject(NutritionFacade);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('lists the lots by name, selects the named one, and shows its plans newest first with the plan in force', async () => {
    await facade.open('ranch-1', 'lot-1');

    expect(facade.lots().map(lot => lot.name)).toEqual(['Heifers', 'Weaned']);
    expect(facade.selectedLot()?.name).toBe('Heifers');
    expect(facade.history().map(plan => plan.name)).toEqual(['Dry season', 'Wet season']);
    expect(facade.current()?.name).toBe('Dry season');
    expect(facade.changeDays()).toEqual(new Set(['2026-11-05']));
  });

  it('counts the active animals of the lot for the feed estimate', async () => {
    await facade.open('ranch-1', 'lot-1');

    expect(cattle.monitoredCattle).toHaveBeenCalledWith('ranch-1', { activeOnly: true, lotId: 'lot-1' }, Number.POSITIVE_INFINITY);
    expect(facade.headCount()).toBe(3);
  });

  it('reads the rumination from before the current plan and compares the mean before and after its change', async () => {
    await facade.open('ranch-1', 'lot-1');

    expect(analytics.lotTrend).toHaveBeenCalledWith('ranch-1', 'lot-1', 'rumination-minutes', new Date(2026, 9, 6), new Date(2026, 10, 13));
    expect(facade.rumination()).toMatchObject({ changeDays: ['2026-11-05'], around: { before: 400, after: 455 } });
    expect(facade.rumination()?.days.map(day => day.day)).toEqual(['2026-11-04', '2026-11-06', '2026-11-07']);
  });

  it('reads the last 30 days and shows no plan when no plan covers today', async () => {
    plans.current.mockResolvedValueOnce(null);

    await facade.open('ranch-1', 'lot-1');

    expect(facade.current()).toBeNull();
    expect(facade.error()).toBeNull();
    expect(analytics.lotTrend).toHaveBeenCalledWith('ranch-1', 'lot-1', 'rumination-minutes', new Date(2026, 9, 14), new Date(2026, 10, 13));
  });

  it('keeps the other reads when the history cannot be read', async () => {
    plans.list.mockRejectedValueOnce(new ApiError(0, 'network', null));

    await facade.open('ranch-1', 'lot-1');

    expect(facade.error()).toMatchObject({ code: 'network' });
    expect(facade.history()).toEqual([]);
    expect(facade.current()?.name).toBe('Dry season');
    expect(facade.headCount()).toBe(3);
  });

  it('registers a plan for the selected lot and reloads the lot', async () => {
    await facade.open('ranch-1', 'lot-1');
    const request: RegisterNutritionPlan = {
      name: 'Drought', validFrom: '2026-11-13', validTo: null, items: items(14), targetDailyGainKilograms: null, notes: null,
    };

    await facade.register(request);

    expect(plans.register).toHaveBeenCalledWith('ranch-1', 'lot-1', request);
    expect(plans.list).toHaveBeenCalledTimes(2);
  });

  it('clears the lot when the chosen id is not a lot of the ranch, and refuses a registration without a lot', async () => {
    await facade.open('ranch-1', 'lot-1');
    await facade.selectLot('lot-unknown');

    expect(facade.lotId()).toBeNull();
    expect(facade.history()).toEqual([]);
    expect(plans.list).toHaveBeenCalledTimes(1);
    await expect(facade.register({
      name: 'Drought', validFrom: '2026-11-13', validTo: null, items: items(14), targetDailyGainKilograms: null, notes: null,
    })).rejects.toMatchObject({ code: 'configuration' });
  });
});
