import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { AnalyticsPeriod } from '../../domain/model/analytics-period';
import type { ExecutiveReportDocument } from '../../domain/model/executive-report.model';
import { ExecutiveReportRepository } from '../../domain/repositories/executive-report.repository';
import { ExecutiveReportFacade } from './executive-report.facade';

const period: AnalyticsPeriod = { from: new Date('2026-10-12T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };
const next: AnalyticsPeriod = { from: new Date('2026-11-01T05:00:00Z'), to: new Date('2026-11-12T05:00:00Z') };

const document = { generatedAt: '2026-11-12T00:00:00Z', indicators: {} } as unknown as ExecutiveReportDocument;

describe('ExecutiveReportFacade', () => {
  let facade: ExecutiveReportFacade;
  let reports: { document: ReturnType<typeof vi.fn>; csv: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reports = {
      document: vi.fn(async () => document),
      csv: vi.fn(async () => ({ content: new Blob(['Metric\r\n']) })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ExecutiveReportFacade, { provide: ExecutiveReportRepository, useValue: reports }],
    });
    facade = TestBed.inject(ExecutiveReportFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('previews the JSON document of the period', async () => {
    await facade.open('ranch-1', period);

    expect(reports.document).toHaveBeenCalledWith('ranch-1', period);
    expect(facade.preview()).toBe(document);
  });

  it('builds downloads from the current period and ranch, requesting fresh data each time', async () => {
    await facade.open('ranch-1', period);
    await facade.setPeriod(next);

    await facade.document();
    await facade.csv();

    expect(reports.document).toHaveBeenLastCalledWith('ranch-1', next);
    expect(reports.csv).toHaveBeenCalledWith('ranch-1', next);
  });

  it('exposes the refusal of the export plan as the failure of the preview', async () => {
    reports.document.mockRejectedValueOnce(new ApiError(403, 'DashboardAnalytics.ExportNotIncluded', 'Export is not in the plan.'));

    await facade.open('ranch-1', period);

    expect(facade.preview()).toBeNull();
    expect(facade.error()?.code).toBe('DashboardAnalytics.ExportNotIncluded');
  });

  it('refuses a download when no ranch is current', async () => {
    await facade.open(null, period);

    await expect(facade.csv()).rejects.toBeInstanceOf(ApiError);
    expect(reports.csv).not.toHaveBeenCalled();
  });
});
