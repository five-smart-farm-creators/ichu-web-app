import { computed, inject, Injectable, signal } from '@angular/core';
import type { DecideHerdAdvisory, GrantHerdAdvisory, HerdAdvisoryRecord, RequestHerdAdvisory } from '../../domain/model/herd-advisory.model';
import type { CompleteProfessionalProfile } from '../../domain/model/professional-profile.model';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { AuthFacade } from './auth.facade';

/** Coordinates authenticated account, professional-profile, and advisory workspace actions. */
@Injectable()
export class AccountWorkspaceFacade {
  private readonly authentication = inject(AuthFacade);
  private readonly profiles = inject(ProfessionalProfileRepository);
  private readonly advisoryRepository = inject(HerdAdvisoryRepository);
  private initialization: Promise<void> | null = null;
  private listGeneration = 0;

  readonly account = computed(() => this.authentication.account());
  readonly name = computed(() => this.authentication.name());
  readonly emailVerified = computed(() => this.authentication.currentUser()?.emailVerified ?? false);
  readonly ranchAccess = computed(() => this.authentication.ranchAccess());
  readonly isVeterinarian = computed(() => this.account()?.role === 'Veterinarian');
  readonly isRanchManager = computed(() => this.account()?.role === 'RanchManager');
  readonly manageableRanches = computed(() => this.isRanchManager()
    ? this.ranchAccess().filter(access => access.scope === 'Manage')
    : []);
  readonly selectedRanchCanBeManaged = computed(() => {
    const ranchId = this.selectedRanchId();
    return Boolean(ranchId && this.canManageRanch(ranchId));
  });

  readonly sessionLoading = signal(true);
  readonly actionInProgress = signal(false);
  readonly advisoryLoading = signal(false);
  readonly selectedRanchId = signal('');
  readonly advisories = signal<readonly HerdAdvisoryRecord[]>([]);
  readonly requestResult = signal<HerdAdvisoryRecord | null>(null);
  readonly workspaceError = signal<string | null>(null);
  readonly advisoryError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** Waits for the verified session and optionally loads its first authorized ranch. */
  initialize(loadInitialAdvisories = false): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.loadSession(loadInitialAdvisories);
    }
    return this.initialization;
  }

  /** Loads advisory records only for a ranch present in the authenticated access snapshot. */
  async loadAdvisories(ranchId: string): Promise<void> {
    const normalizedRanchId = ranchId.trim();
    const account = this.authentication.account();
    if (!account || !this.authentication.currentUser()) {
      this.advisoryError.set('Sign in with a verified account to view advisory requests.');
      return;
    }
    if (!normalizedRanchId || !this.authentication.ranchAccess().some(access => access.ranchId === normalizedRanchId)) {
      this.advisoryError.set('Choose a ranch listed in your authorized access.');
      return;
    }

    const generation = ++this.listGeneration;
    const accountId = account.id;
    this.selectedRanchId.set(normalizedRanchId);
    this.advisoryLoading.set(true);
    this.advisoryError.set(null);
    this.successMessage.set(null);
    try {
      const records = await this.advisoryRepository.list(normalizedRanchId);
      if (generation === this.listGeneration
        && this.isCurrentAccount(accountId)
        && this.selectedRanchId() === normalizedRanchId) {
        this.advisories.set(records);
      }
    } catch (error) {
      if (generation === this.listGeneration && this.isCurrentAccount(accountId)) {
        this.advisoryError.set(this.errorMessage(error, 'Advisory requests could not be loaded. Try again.'));
      }
    } finally {
      if (generation === this.listGeneration) {
        this.advisoryLoading.set(false);
      }
    }
  }

  /** Saves a veterinarian profile and replaces the account with the backend response. */
  async saveProfessionalProfile(profile: CompleteProfessionalProfile): Promise<boolean> {
    if (!this.isVeterinarian()) {
      this.workspaceError.set('Only veterinarian accounts can update a professional profile.');
      return false;
    }

    return this.runAccountAction(
      () => this.profiles.complete(profile),
      account => this.authentication.account.set(account),
      'Professional profile saved.',
    );
  }

  /** Submits a ranch access request and retains the record returned by the IAM service. */
  async requestAccess(request: RequestHerdAdvisory): Promise<boolean> {
    if (!this.isVeterinarian()) {
      this.workspaceError.set('Only veterinarian accounts can request advisory access.');
      return false;
    }

    this.requestResult.set(null);
    return this.runAccountAction(
      () => this.advisoryRepository.request(request),
      record => this.requestResult.set(record),
      'Access request submitted.',
    );
  }

  /** Creates a direct ranch grant for a ranch the current manager can manage. */
  async grantAccess(grant: GrantHerdAdvisory): Promise<boolean> {
    if (!this.isRanchManager() || !this.canManageRanch(grant.ranchId)) {
      this.workspaceError.set('Your account does not have Manage access for this ranch.');
      return false;
    }

    return this.runAccountAction(
      () => this.advisoryRepository.grant(grant),
      record => this.upsertAdvisory(record),
      'Ranch access grant saved.',
    );
  }

  /** Applies an advisory decision for a ranch the current manager can manage. */
  async decideAdvisory(id: string, decision: DecideHerdAdvisory): Promise<boolean> {
    const ranchId = this.selectedRanchId();
    if (!this.isRanchManager() || !ranchId || !this.canManageRanch(ranchId)) {
      this.workspaceError.set('Your account does not have Manage access for the selected ranch.');
      return false;
    }

    return this.runAccountAction(
      () => this.advisoryRepository.decide(id, decision),
      record => this.upsertAdvisory(record),
      decision.decision === 'revoke' ? 'Ranch access revoked.' : 'Advisory decision saved.',
    );
  }

  /** Signs out and invalidates any outstanding advisory-list response. */
  async signOut(): Promise<boolean> {
    if (this.actionInProgress()) {
      return false;
    }

    this.actionInProgress.set(true);
    this.workspaceError.set(null);
    this.successMessage.set(null);
    this.listGeneration += 1;
    this.advisoryLoading.set(false);
    this.advisories.set([]);
    this.requestResult.set(null);
    try {
      await this.authentication.signOut();
      return true;
    } catch (error) {
      this.workspaceError.set(this.errorMessage(error, 'Sign out could not be completed. Try again.'));
      return false;
    } finally {
      this.actionInProgress.set(false);
    }
  }

  private async loadSession(loadInitialAdvisories: boolean): Promise<void> {
    try {
      await this.authentication.ready();
      if (!this.authentication.currentUser() || !this.authentication.account()) {
        this.workspaceError.set('A verified ICHU account is required to open this workspace.');
        return;
      }
      if (loadInitialAdvisories) {
        const firstAuthorizedRanch = this.authentication.ranchAccess()[0];
        if (firstAuthorizedRanch) {
          await this.loadAdvisories(firstAuthorizedRanch.ranchId);
        }
      }
    } catch (error) {
      this.workspaceError.set(this.errorMessage(error, 'The account workspace could not be loaded.'));
    } finally {
      this.sessionLoading.set(false);
    }
  }

  private async runAccountAction<T>(
    operation: () => Promise<T>,
    applyResult: (result: T) => void,
    successMessage: string,
  ): Promise<boolean> {
    if (this.actionInProgress()) {
      return false;
    }
    const account = this.authentication.account();
    if (!account || !this.authentication.currentUser()) {
      this.workspaceError.set('Sign in with a verified account before continuing.');
      return false;
    }

    this.actionInProgress.set(true);
    this.workspaceError.set(null);
    this.advisoryError.set(null);
    this.successMessage.set(null);
    try {
      const result = await operation();
      if (!this.isCurrentAccount(account.id)) {
        return false;
      }
      applyResult(result);
      this.successMessage.set(successMessage);
      return true;
    } catch (error) {
      if (this.isCurrentAccount(account.id)) {
        this.workspaceError.set(this.errorMessage(error, 'The request could not be completed. Try again.'));
      }
      return false;
    } finally {
      this.actionInProgress.set(false);
    }
  }

  private canManageRanch(ranchId: string): boolean {
    return this.authentication.ranchAccess().some(access =>
      access.ranchId === ranchId && access.scope === 'Manage');
  }

  private isCurrentAccount(accountId: string): boolean {
    return this.authentication.currentUser() !== null
      && this.authentication.account()?.id === accountId;
  }

  private upsertAdvisory(record: HerdAdvisoryRecord): void {
    if (record.ranchId !== this.selectedRanchId()) {
      return;
    }
    const current = [...this.advisories()];
    const index = current.findIndex(item => item.id === record.id);
    if (index < 0) {
      current.unshift(record);
    } else {
      current[index] = record;
    }
    this.advisories.set(current);
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback;
  }
}
