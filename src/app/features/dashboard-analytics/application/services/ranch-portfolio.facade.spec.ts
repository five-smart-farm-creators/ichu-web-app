import { TestBed } from '@angular/core/testing';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import type { RanchPortfolioEntry } from '../../domain/model/ranch-portfolio.model';
import { RanchPortfolioRepository } from '../../domain/repositories/ranch-portfolio.repository';
import { RanchPortfolioFacade } from './ranch-portfolio.facade';

function entry(ranchId: string, criticalAlerts: number, warningAlerts: number, informativeAlerts: number): RanchPortfolioEntry {
  return {
    ranchId, updatedAt: '2026-11-12T00:00:00Z', source: 'ichu-platform', criticalAlerts, warningAlerts, informativeAlerts,
    unresponsiveTreatmentAnimals: null, overdueCampaigns: null,
  };
}

describe('RanchPortfolioFacade', () => {
  let facade: RanchPortfolioFacade;
  let portfolio: { list: ReturnType<typeof vi.fn> };
  let context: { selectRanch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portfolio = {
      list: vi.fn(async () => [entry('ranch-b', 0, 2, 0), entry('ranch-a', 1, 0, 5), entry('ranch-c', 0, 2, 1)]),
    };
    context = { selectRanch: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        RanchPortfolioFacade,
        { provide: RanchPortfolioRepository, useValue: portfolio },
        { provide: IamContextFacade, useValue: context },
      ],
    });
    facade = TestBed.inject(RanchPortfolioFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the ranches with critical alerts first, then warnings, then informative alerts', async () => {
    await facade.load();

    expect(facade.entries().map(item => item.ranchId)).toEqual(['ranch-a', 'ranch-c', 'ranch-b']);
    expect(facade.loading()).toBe(false);
  });

  it('makes the chosen ranch the current one through the IAM facade', () => {
    facade.open('ranch-c');

    expect(context.selectRanch).toHaveBeenCalledWith('ranch-c');
  });
});
