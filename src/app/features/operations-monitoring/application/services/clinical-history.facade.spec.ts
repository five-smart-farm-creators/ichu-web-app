import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import {
  CattleInformationContextFacade, type MonitoredCattleSummary,
} from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade, type WithdrawalSummary } from '../../../planning/application/acl/planning-context.facade';
import { DAY_MILLISECONDS, type LivestockOperation, type OperationType } from '../../domain/model/livestock-operation.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { ClinicalHistoryFacade } from './clinical-history.facade';

const animals: MonitoredCattleSummary[] = [
  { cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' },
  { cattleId: 'cattle-2', earTag: '102', status: 'Inactive', lifeStage: 'MilkingCow', sex: 'Female' },
];

function operation(id: string, type: OperationType, occurredAt: string): LivestockOperation {
  const clinical = type === 'Vaccination' || type === 'Treatment' || type === 'Insemination' || type === 'PregnancyDiagnosis';
  const hasProduct = type === 'Vaccination' || type === 'Treatment';
  return {
    operationId: id, cattleId: 'cattle-1', type, isClinical: clinical, occurredAt, receivedAt: occurredAt,
    observation: null, product: hasProduct ? 'Vaccine' : null, dose: hasProduct ? '2 ml' : null,
    sireReference: null, pregnancyResult: null, expectedCalvingDate: null,
  };
}

function withdrawal(state: WithdrawalSummary['state']): WithdrawalSummary {
  return { state, startsAt: '2026-11-10T00:00:00Z', endsAt: '2026-11-13T00:00:00Z', daysRemaining: state === 'Active' ? 2 : null };
}

describe('ClinicalHistoryFacade', () => {
  let facade: ClinicalHistoryFacade;
  let records: { list: ReturnType<typeof vi.fn> };
  let telemetry: { latest: ReturnType<typeof vi.fn> };
  let alerts: { list: ReturnType<typeof vi.fn> };
  let planning: { withdrawalPeriodsFor: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    records = { list: vi.fn(async () => []) };
    telemetry = { latest: vi.fn(async () => ({ cattleId: 'cattle-1' })) };
    alerts = { list: vi.fn(async () => ({ page: 1, pageSize: 1, totalCount: 2, items: [] })) };
    planning = { withdrawalPeriodsFor: vi.fn(async () => []) };
    cattleContext = { monitoredCattle: vi.fn(async () => animals) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ClinicalHistoryFacade,
        { provide: LivestockOperationRepository, useValue: records },
        { provide: TelemetryRepository, useValue: telemetry },
        { provide: AlertRepository, useValue: alerts },
        { provide: PlanningContextFacade, useValue: planning },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(ClinicalHistoryFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens the named animal and shows its history newest first', async () => {
    records.list.mockResolvedValue([
      operation('old', 'Vaccination', '2026-01-10T10:00:00.000Z'),
      operation('new', 'HealthEvent', '2026-11-10T10:00:00.000Z'),
      operation('mid', 'Treatment', '2026-06-01T10:00:00.000Z'),
    ]);

    await facade.open('ranch-1', 'cattle-1');

    expect(facade.animal()?.earTag).toBe('101');
    expect(facade.timeline().map(item => item.operationId)).toEqual(['new', 'mid', 'old']);
  });

  it('narrows the timeline by type without asking the API again', async () => {
    records.list.mockResolvedValue([
      operation('mid', 'Treatment', '2026-06-01T10:00:00.000Z'),
      operation('new', 'HealthEvent', '2026-11-10T10:00:00.000Z'),
    ]);
    await facade.open('ranch-1', 'cattle-1');
    const requestsBefore = records.list.mock.calls.length;

    facade.setTypeFilter('Treatment');

    expect(facade.timeline().map(item => item.operationId)).toEqual(['mid']);
    expect(records.list).toHaveBeenCalledTimes(requestsBefore);
  });

  it('reads the chosen period as a window that ends tomorrow', async () => {
    await facade.open('ranch-1', 'cattle-1');
    const yearWindow = records.list.mock.calls[0][2] as { from: Date; to: Date };

    expect((yearWindow.to.getTime() - yearWindow.from.getTime()) / DAY_MILLISECONDS).toBe(366);

    await facade.setPeriod('90d');
    const quarterWindow = records.list.mock.calls.at(-1)?.[2] as { from: Date; to: Date };
    expect((quarterWindow.to.getTime() - quarterWindow.from.getTime()) / DAY_MILLISECONDS).toBe(91);
  });

  it('reloads the history and the summary on refresh, after a record was saved', async () => {
    await facade.open('ranch-1', 'cattle-1');
    records.list.mockResolvedValueOnce([operation('saved', 'HealthEvent', '2026-11-10T10:00:00.000Z')]);

    await facade.refresh();

    expect(facade.timeline().map(item => item.operationId)).toEqual(['saved']);
    expect(telemetry.latest).toHaveBeenCalledTimes(2);
  });

  it('keeps the other summary values when one of them cannot be read', async () => {
    telemetry.latest.mockRejectedValueOnce(new ApiError(0, 'network', null));
    planning.withdrawalPeriodsFor.mockResolvedValueOnce([withdrawal('Active')]);
    alerts.list.mockResolvedValueOnce({ page: 1, pageSize: 1, totalCount: 3, items: [] });

    await facade.open('ranch-1', 'cattle-1');

    expect(facade.summary()).toEqual({ latest: null, pendingAlerts: 3, withdrawal: withdrawal('Active'), incomplete: true });
  });

  it('names the active withdrawal, otherwise the next one to start, and never an ended one', async () => {
    await facade.open('ranch-1', null);
    planning.withdrawalPeriodsFor.mockResolvedValueOnce([withdrawal('Ended'), withdrawal('Upcoming')]);
    await facade.selectAnimal('cattle-1');
    expect(facade.summary()?.withdrawal?.state).toBe('Upcoming');

    planning.withdrawalPeriodsFor.mockResolvedValueOnce([withdrawal('Ended')]);
    await facade.selectAnimal('cattle-1');
    expect(facade.summary()?.withdrawal).toBeNull();
    expect(facade.summary()?.incomplete).toBe(false);
  });

  it('forgets the selected animal when the ranch changes, so a period change loads nothing', async () => {
    await facade.open('ranch-1', 'cattle-1');
    records.list.mockClear();

    await facade.open('ranch-2', null);
    await facade.setPeriod('5y');

    expect(facade.animal()).toBeNull();
    expect(records.list).not.toHaveBeenCalled();
  });

  it('does not load a history for an animal that is not in the ranch', async () => {
    await facade.open('ranch-1', null);

    await facade.selectAnimal('cattle-unknown');

    expect(facade.animal()).toBeNull();
    expect(records.list).not.toHaveBeenCalled();
  });
});
