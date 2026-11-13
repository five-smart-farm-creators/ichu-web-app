import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import { isValidHeadCount, type Plan, type PlanQuote, type PlanTier, recommendedPlan } from '../../domain/model/plan.model';
import { PlanRepository } from '../../domain/repositories/plan.repository';

/** Waits for a pause in typing so that each digit does not send its own set of quote requests. */
const QUOTE_DEBOUNCE_MS = 300;

/** Holds the published plans, the head count the visitor entered, and one quote per plan for that count. */
@Injectable()
export class PlansFacade {
  private readonly repository = inject(PlanRepository);
  private catalogRequest = 0;
  private quoteRequest = 0;
  private quoteTimer: ReturnType<typeof setTimeout> | null = null;

  readonly plans = signal<readonly Plan[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly headCount = signal<number | null>(null);
  readonly selectedTier = signal<PlanTier | null>(null);
  readonly quotes = signal<ReadonlyMap<string, PlanQuote>>(new Map());
  readonly quoteErrors = signal<ReadonlyMap<string, ApiError>>(new Map());
  readonly quoting = signal(false);
  readonly recommended = computed(() => {
    const headCount = this.headCount();
    return isValidHeadCount(headCount) ? recommendedPlan(this.plans(), headCount) : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearQuoteTimer());
  }

  /** Loads the published plans, then quotes the head count the visitor arrived with when it is valid. */
  async open(preselection: { readonly tier: PlanTier | null; readonly headCount: number | null }): Promise<void> {
    this.clearQuoteTimer();
    this.quoteRequest++;
    this.selectedTier.set(preselection.tier);
    this.headCount.set(preselection.headCount);
    this.quotes.set(new Map());
    this.quoteErrors.set(new Map());
    this.quoting.set(false);
    const request = ++this.catalogRequest;
    this.loading.set(true);
    this.error.set(null);
    try {
      const plans = await this.repository.list();
      if (request !== this.catalogRequest) return;
      this.plans.set(plans);
      await this.refreshQuotes();
    } catch (error) {
      if (request === this.catalogRequest) this.error.set(toApiError(error));
    } finally {
      if (request === this.catalogRequest) this.loading.set(false);
    }
  }

  /** Records the head count and quotes it after a short pause; an invalid value drops every quote at once. */
  setHeadCount(value: number | null): void {
    this.clearQuoteTimer();
    this.quoteRequest++;
    this.headCount.set(value);
    this.quotes.set(new Map());
    this.quoteErrors.set(new Map());
    this.quoting.set(false);
    if (!isValidHeadCount(value)) return;
    this.quoteTimer = setTimeout(() => {
      this.quoteTimer = null;
      void this.refreshQuotes();
    }, QUOTE_DEBOUNCE_MS);
  }

  /** Requests one quote per plan for the current head count; a newer request makes the answers of this one stale. */
  async refreshQuotes(): Promise<void> {
    const headCount = this.headCount();
    const catalog = this.plans();
    if (!isValidHeadCount(headCount) || catalog.length === 0) return;
    const request = ++this.quoteRequest;
    this.quoting.set(true);
    this.quotes.set(new Map());
    this.quoteErrors.set(new Map());
    const results = await Promise.allSettled(catalog.map(plan => this.repository.quote(plan.id, headCount)));
    if (request !== this.quoteRequest) return;
    const quotes = new Map<string, PlanQuote>();
    const errors = new Map<string, ApiError>();
    results.forEach((result, index) => {
      const planId = catalog[index].id;
      if (result.status === 'fulfilled') quotes.set(planId, result.value);
      else errors.set(planId, toApiError(result.reason));
    });
    this.quotes.set(quotes);
    this.quoteErrors.set(errors);
    this.quoting.set(false);
  }

  private clearQuoteTimer(): void {
    if (this.quoteTimer === null) return;
    clearTimeout(this.quoteTimer);
    this.quoteTimer = null;
  }
}
