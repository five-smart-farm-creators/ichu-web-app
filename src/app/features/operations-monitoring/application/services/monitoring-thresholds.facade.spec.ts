import { TestBed } from '@angular/core/testing';
import type { MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import { MonitoringThresholdRepository } from '../../domain/repositories/monitoring-threshold.repository';
import { MonitoringThresholdsFacade } from './monitoring-thresholds.facade';

function threshold(lifeStage: string, metric: MonitoringThreshold['metric'], minValue: number, maxValue: number): MonitoringThreshold {
  return { thresholdId: `${lifeStage}-${metric}`, lifeStage, metric, minValue, maxValue, severity: 'Warning', revision: 1 };
}

describe('MonitoringThresholdsFacade', () => {
  let facade: MonitoringThresholdsFacade;
  let repository: { list: ReturnType<typeof vi.fn>; configure: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = {
      list: vi.fn(async () => [threshold('MilkingCow', 'ActivityIndex', 1, 9), threshold('Calf', 'BodyTemperature', 38, 39.5)]),
      configure: vi.fn(async () => threshold('Calf', 'BodyTemperature', 37.8, 39.2)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [MonitoringThresholdsFacade, { provide: MonitoringThresholdRepository, useValue: repository }],
    });
    facade = TestBed.inject(MonitoringThresholdsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the thresholds sorted by stage and metric', async () => {
    await facade.open('ranch-1');

    expect(facade.thresholds().map(item => item.lifeStage)).toEqual(['Calf', 'MilkingCow']);
  });

  it('replaces only the band of the same stage and metric when one is configured', async () => {
    await facade.open('ranch-1');

    await facade.configure({ lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37.8, maxValue: 39.2, severity: 'Warning' });

    expect(repository.configure).toHaveBeenCalledWith('ranch-1', {
      lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37.8, maxValue: 39.2, severity: 'Warning',
    });
    expect(facade.thresholds()).toHaveLength(2);
    expect(facade.thresholds()[0]).toMatchObject({ minValue: 37.8, maxValue: 39.2 });
  });

  it('keeps the list unchanged when the API refuses a band', async () => {
    await facade.open('ranch-1');
    repository.configure.mockRejectedValueOnce(new Error('refused'));

    await expect(facade.configure({ lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 1, maxValue: 2, severity: 'Warning' }))
      .rejects.toThrow('refused');
    expect(facade.thresholds()[0]).toMatchObject({ minValue: 38, maxValue: 39.5 });
  });
});
