import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { type AnalyticsPeriod, DEFAULT_PERIOD_DAYS, presetPeriod } from '../../domain/model/analytics-period';
import type { DownloadedFile, ExecutiveReportDocument } from '../../domain/model/executive-report.model';
import { ExecutiveReportRepository } from '../../domain/repositories/executive-report.repository';

/** Previews the executive report of the period and produces its downloads from the same API. */
@Injectable()
export class ExecutiveReportFacade {
  private readonly reports = inject(ExecutiveReportRepository);
  private ranchId: string | null = null;
  private request = 0;

  readonly period = signal<AnalyticsPeriod>(presetPeriod(DEFAULT_PERIOD_DAYS, new Date()));
  readonly preview = signal<ExecutiveReportDocument | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  async open(ranchId: string | null, period: AnalyticsPeriod): Promise<void> {
    this.ranchId = ranchId;
    this.period.set(period);
    await this.loadPreview();
  }

  async setPeriod(period: AnalyticsPeriod): Promise<void> {
    this.period.set(period);
    await this.loadPreview();
  }

  /** Requests the document again, so a PDF or Excel file reflects the data at the moment it is downloaded. */
  async document(): Promise<ExecutiveReportDocument> {
    return this.reports.document(this.requireRanch(), this.period());
  }

  async csv(): Promise<DownloadedFile> {
    return this.reports.csv(this.requireRanch(), this.period());
  }

  private async loadPreview(): Promise<void> {
    const ranchId = this.ranchId;
    const request = ++this.request;
    if (!ranchId) {
      this.preview.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const document = await this.reports.document(ranchId, this.period());
      if (request === this.request) this.preview.set(document);
    } catch (error) {
      if (request === this.request) {
        this.preview.set(null);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  private requireRanch(): string {
    if (!this.ranchId) throw new ApiError(0, 'configuration', null);
    return this.ranchId;
  }
}
