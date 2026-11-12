import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { WithdrawalPeriod } from '../../domain/model/withdrawal-period.model';
import { WithdrawalPeriodRepository } from '../../domain/repositories/withdrawal-period.repository';
import { WithdrawalPeriodsFacade } from './withdrawal-periods.facade';

const animals: MonitoredCattleSummary[] = [
  { cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' },
  { cattleId: 'cattle-2', earTag: '102', status: 'Inactive', lifeStage: 'MilkingCow', sex: 'Female' },
];

const period: WithdrawalPeriod = {
  id: 'period-1', cattleId: 'cattle-1', interventionId: null, startsAt: '2026-11-10T00:00:00.000Z', endsAt: '2026-11-13T00:00:00.000Z',
};

describe('WithdrawalPeriodsFacade', () => {
  let facade: WithdrawalPeriodsFacade;
  let periods: { list: ReturnType<typeof vi.fn>; record: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    periods = { list: vi.fn(async () => [period]), record: vi.fn(async () => period) };
    cattleContext = { monitoredCattle: vi.fn(async () => animals) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        WithdrawalPeriodsFacade,
        { provide: WithdrawalPeriodRepository, useValue: periods },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(WithdrawalPeriodsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the animals of the ranch and every period of the ranch', async () => {
    await facade.open('ranch-1');

    expect(cattleContext.monitoredCattle).toHaveBeenCalledWith('ranch-1', { activeOnly: false }, Number.POSITIVE_INFINITY);
    expect(periods.list).toHaveBeenCalledWith('ranch-1', null);
    expect(facade.animals()).toHaveLength(2);
    expect(facade.rows()).toEqual([period]);
  });

  it('narrows the periods to one animal', async () => {
    await facade.open('ranch-1');

    await facade.filterByCattle('cattle-1');

    expect(periods.list).toHaveBeenLastCalledWith('ranch-1', 'cattle-1');
    expect(facade.cattleFilter()).toBe('cattle-1');
  });

  it('records a period and reloads with the filter that was active', async () => {
    await facade.open('ranch-1');
    await facade.filterByCattle('cattle-1');
    const request = { cattleId: 'cattle-1', interventionId: null, startsAt: period.startsAt, endsAt: period.endsAt };

    await facade.record(request);

    expect(periods.record).toHaveBeenCalledWith('ranch-1', request);
    expect(periods.list).toHaveBeenLastCalledWith('ranch-1', 'cattle-1');
  });

  it('refuses to record a period when no ranch is open', async () => {
    await facade.open(null);

    await expect(facade.record({ cattleId: 'cattle-1', interventionId: null, startsAt: period.startsAt, endsAt: period.endsAt }))
      .rejects.toMatchObject({ code: 'configuration' });
    expect(periods.record).not.toHaveBeenCalled();
  });

  it('shows the API error of a failed listing and no stale periods', async () => {
    await facade.open('ranch-1');
    periods.list.mockRejectedValueOnce(new ApiError(403, 'http-403', null));

    await facade.filterByCattle('cattle-2');

    expect(facade.error()?.status).toBe(403);
    expect(facade.rows()).toEqual([]);
  });
});
