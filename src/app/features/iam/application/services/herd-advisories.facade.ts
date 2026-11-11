import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { DecideHerdAdvisory, HerdAdvisoryRecord } from '../../domain/model/herd-advisory.model';
import type { RanchSummary } from '../../domain/model/ranch-summary.model';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { RanchDirectoryRepository } from '../../domain/repositories/ranch-directory.repository';
import { IamContextFacade } from '../acl/iam-context.facade';
import { AuthFacade } from './auth.facade';

type AdvisoryNotice = 'granted' | 'rejected' | 'revoked';

const NOTICE_BY_DECISION: Readonly<Record<DecideHerdAdvisory['decision'], AdvisoryNotice>> = {
  grant: 'granted',
  reject: 'rejected',
  revoke: 'revoked',
};

/** Coordinates access requests and manager decisions; the page translates the codes it exposes. */
@Injectable()
export class HerdAdvisoriesFacade {
  private readonly authentication = inject(AuthFacade);
  private readonly context = inject(IamContextFacade);
  private readonly advisories = inject(HerdAdvisoryRepository);
  private readonly ranchDirectory = inject(RanchDirectoryRepository);
  private listGeneration = 0;
  private lookupGeneration = 0;

  readonly isVeterinarian = computed(() => this.authentication.account()?.role === 'Veterinarian');
  readonly profileComplete = computed(() => Boolean(this.authentication.account()?.profile));
  /** Only a ranch the account can manage has advisory requests to review. */
  readonly manageableRanchId = computed(() => {
    const ranch = this.context.currentRanch();
    return ranch?.scope === 'Manage' ? ranch.ranchId : null;
  });

  readonly foundRanch = signal<RanchSummary | null>(null);
  readonly ranchNotFound = signal(false);
  readonly lookupBusy = signal(false);
  readonly requestBusy = signal(false);
  readonly requestedAdvisory = signal<HerdAdvisoryRecord | null>(null);
  readonly records = signal<readonly HerdAdvisoryRecord[]>([]);
  readonly listLoading = signal(false);
  readonly decisionBusy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly notice = signal<AdvisoryNotice | null>(null);

  constructor() {
    effect(() => {
      const ranchId = this.manageableRanchId();
      untracked(() => { void this.loadRecords(ranchId); });
    });
  }

  /** Looks up the ranch behind an access code so the veterinarian can confirm it before requesting access. */
  async findRanch(code: string): Promise<void> {
    this.foundRanch.set(null);
    this.ranchNotFound.set(false);
    this.requestedAdvisory.set(null);
    this.error.set(null);
    if (!this.isVeterinarian()) {
      this.error.set(forbiddenError());
      return;
    }

    const generation = ++this.lookupGeneration;
    this.lookupBusy.set(true);
    try {
      const ranch = await this.ranchDirectory.findByAccessCode(code);
      if (generation === this.lookupGeneration) {
        this.foundRanch.set(ranch);
        this.ranchNotFound.set(ranch === null);
      }
    } catch (error) {
      if (generation === this.lookupGeneration) this.error.set(toApiError(error));
    } finally {
      if (generation === this.lookupGeneration) this.lookupBusy.set(false);
    }
  }

  /** Drops the match and any lookup still in flight when the code changes, so no request targets a stale ranch. */
  clearLookup(): void {
    this.lookupGeneration++;
    this.lookupBusy.set(false);
    this.foundRanch.set(null);
    this.ranchNotFound.set(false);
  }

  /** Requests access for the ranch the last lookup found; the veterinarian profile must be complete. */
  async requestAccess(reason: string): Promise<boolean> {
    if (!this.isVeterinarian() || !this.profileComplete()) {
      this.error.set(forbiddenError());
      return false;
    }
    const ranch = this.foundRanch();
    if (!ranch) return false;

    this.requestBusy.set(true);
    this.error.set(null);
    this.requestedAdvisory.set(null);
    try {
      this.requestedAdvisory.set(await this.advisories.request(ranch.ranchId, { reason }));
      this.foundRanch.set(null);
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.requestBusy.set(false);
    }
  }

  /** Grants, rejects, or revokes an advisory on the managed ranch and replaces its row with the response. */
  async decide(advisoryId: string, decision: DecideHerdAdvisory): Promise<boolean> {
    const ranchId = this.manageableRanchId();
    if (!ranchId) {
      this.error.set(forbiddenError());
      return false;
    }

    this.decisionBusy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const updated = await this.advisories.decide(ranchId, advisoryId, decision);
      // A ranch switch during the request means the response belongs to a list that is no longer shown.
      if (ranchId === this.manageableRanchId()) {
        this.records.update(records => records.map(record => (record.id === updated.id ? updated : record)));
      }
      this.notice.set(NOTICE_BY_DECISION[decision.decision]);
      return true;
    } catch (error) {
      this.error.set(toApiError(error));
      return false;
    } finally {
      this.decisionBusy.set(false);
    }
  }

  private async loadRecords(ranchId: string | null): Promise<void> {
    const generation = ++this.listGeneration;
    this.records.set([]);
    this.error.set(null);
    this.notice.set(null);
    if (!ranchId) {
      this.listLoading.set(false);
      return;
    }

    this.listLoading.set(true);
    try {
      const records = await this.advisories.list(ranchId);
      if (generation === this.listGeneration) this.records.set(records);
    } catch (error) {
      if (generation === this.listGeneration) this.error.set(toApiError(error));
    } finally {
      if (generation === this.listGeneration) this.listLoading.set(false);
    }
  }
}

function forbiddenError(): ApiError {
  return new ApiError(403, 'http-403', null);
}
