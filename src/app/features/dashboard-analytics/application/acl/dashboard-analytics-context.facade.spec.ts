import { TestBed } from '@angular/core/testing';
import type { TrendQuery } from '../../domain/model/lot-trend.model';
import { LotTrendRepository } from '../../domain/repositories/lot-trend.repository';
import { DashboardAnalyticsContextFacade } from './dashboard-analytics-context.facade';

describe('DashboardAnalyticsContextFacade', () => {
  let facade: DashboardAnalyticsContextFacade;
  let trends: { lotTrend: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    trends = {
      lotTrend: vi.fn(async () => ({
        points: [{ cattleId: 'cattle-1', recordedAt: '2026-11-10T06:00:00Z', value: 412 }],
        outlierAnimals: ['cattle-2'],
        lotAverage: 410,
        unavailableReason: null,
      })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [DashboardAnalyticsContextFacade, { provide: LotTrendRepository, useValue: trends }],
    });
    facade = TestBed.inject(DashboardAnalyticsContextFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads the lot readings of one metric over the half-open period and publishes only the readings', async () => {
    const from = new Date('2026-10-13T00:00:00Z');
    const to = new Date('2026-11-12T00:00:00Z');

    const readings = await facade.lotTrend('ranch-1', 'lot-1', 'rumination-minutes', from, to);

    expect(trends.lotTrend).toHaveBeenCalledWith('ranch-1', {
      lotId: 'lot-1', period: { from, to }, metric: 'rumination-minutes', deviation: 1,
    } satisfies TrendQuery);
    expect(readings).toEqual({
      points: [{ cattleId: 'cattle-1', recordedAt: '2026-11-10T06:00:00Z', value: 412 }],
      unavailableReason: null,
    });
  });

  it('keeps the reason the API gives when a lot has no readings to show', async () => {
    trends.lotTrend.mockResolvedValueOnce({ points: [], unavailableReason: 'No readings for this lot.' });

    const readings = await facade.lotTrend('ranch-1', 'lot-1', 'rumination-minutes', new Date(0), new Date(1));

    expect(readings).toEqual({ points: [], unavailableReason: 'No readings for this lot.' });
  });
});
