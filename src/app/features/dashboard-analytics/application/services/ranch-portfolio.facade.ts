import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import { type RanchPortfolioEntry, sortByAttention } from '../../domain/model/ranch-portfolio.model';
import { RanchPortfolioRepository } from '../../domain/repositories/ranch-portfolio.repository';

/** Lists the ranches of the account by the attention they need, and switches the current ranch to one of them. */
@Injectable()
export class RanchPortfolioFacade {
  private readonly portfolio = inject(RanchPortfolioRepository);
  private readonly context = inject(IamContextFacade);
  private request = 0;

  readonly entries = signal<readonly RanchPortfolioEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set(null);
    try {
      const entries = await this.portfolio.list();
      if (request === this.request) this.entries.set(sortByAttention(entries));
    } catch (error) {
      if (request === this.request) {
        this.entries.set([]);
        this.error.set(toApiError(error));
      }
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  /** Makes the ranch the current one, so the screens that follow show its data. */
  open(ranchId: string): void {
    this.context.selectRanch(ranchId);
  }
}
