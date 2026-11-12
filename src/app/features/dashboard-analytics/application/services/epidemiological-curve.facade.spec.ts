import { TestBed } from '@angular/core/testing';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { EpidemiologicalCurve } from '../../domain/model/epidemiological-curve.model';
import type { HerdIndicators } from '../../domain/model/herd-indicators.model';
import { EpidemiologicalCurveRepository } from '../../domain/repositories/epidemiological-curve.repository';
import { HerdIndicatorRepository } from '../../domain/repositories/herd-indicator.repository';
import { EpidemiologicalCurveFacade } from './epidemiological-curve.facade';

const period: AnalyticsPeriod = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

function curve(newCasesByDay: Record<string, number>, overrides: Partial<EpidemiologicalCurve> = {}): EpidemiologicalCurve {
  return {
    ranchId: 'ranch-1', period: { from: '2026-10-12T05:00:00Z', to: '2026-11-12T05:00:00Z' }, updatedAt: '2026-11-12T00:00:00Z',
    source: 'ichu-platform', condition: 'temperature', newCasesByDay, daysWithoutNewCases: 3,
    supportsRestrictionLifting: true, unavailableReason: null, ...overrides,
  };
}

describe('EpidemiologicalCurveFacade', () => {
  let facade: EpidemiologicalCurveFacade;
  let curves: { curve: ReturnType<typeof vi.fn> };
  let indicators: { dashboard: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    curves = { curve: vi.fn(async () => curve({ '2026-11-02': 2, '2026-11-03': 1 })) };
    indicators = {
      dashboard: vi.fn(async () => ({ monitoredAnimals: { value: 10, unit: 'animals', formula: '', denominator: 40, unavailableReason: null } }) as unknown as HerdIndicators),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        EpidemiologicalCurveFacade,
        { provide: EpidemiologicalCurveRepository, useValue: curves },
        { provide: HerdIndicatorRepository, useValue: indicators },
      ],
    });
    facade = TestBed.inject(EpidemiologicalCurveFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('derives the cumulative, rolling and peak values, and the attack rate from the herd size of the period', async () => {
    await facade.open('ranch-1', period);

    expect(curves.curve).toHaveBeenCalledWith('ranch-1', period, 'temperature');
    expect(facade.total()).toBe(3);
    expect(facade.cumulative()).toEqual([2, 3]);
    expect(facade.peak()).toEqual({ day: '2026-11-02', cases: 2 });
    expect(facade.attackRate()).toBeCloseTo(7.5, 10);
  });

  it('keeps the curve and reports the attack rate as unknown when the herd size cannot be read', async () => {
    indicators.dashboard.mockRejectedValueOnce(new Error('down'));

    await facade.open('ranch-1', period);

    expect(facade.days()).toHaveLength(2);
    expect(facade.attackRate()).toBeNull();
  });

  it('reads the curve again for another condition', async () => {
    await facade.open('ranch-1', period);
    await facade.setCondition('activity');

    expect(curves.curve).toHaveBeenLastCalledWith('ranch-1', period, 'activity');
  });
});
