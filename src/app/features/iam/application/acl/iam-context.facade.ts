import { computed, inject, Injectable, signal } from '@angular/core';
import type { RanchAccess } from '../../domain/model/auth.model';
import { AuthFacade } from '../services/auth.facade';

const RANCH_STORAGE_PREFIX = 'ichu.currentRanch.';

/** Publishes the account's current ranch to other bounded contexts, which never read IAM internals. */
@Injectable()
export class IamContextFacade {
  private readonly authentication = inject(AuthFacade);
  private readonly choice = signal<{ readonly accountId: string; readonly ranchId: string } | null>(null);

  readonly ranches = computed<readonly RanchAccess[]>(() => this.authentication.ranchAccess());
  readonly currentRole = computed(() => this.authentication.account()?.role ?? null);
  readonly currentRanchId = computed<string | null>(() => {
    const accountId = this.authentication.account()?.id;
    if (!accountId) return null;
    const choice = this.choice();
    const preferred = choice?.accountId === accountId ? choice.ranchId : readStoredRanchId(accountId);
    const accessible = this.ranches();
    return accessible.some(access => access.ranchId === preferred) ? preferred : (accessible[0]?.ranchId ?? null);
  });
  readonly currentRanch = computed<RanchAccess | null>(() =>
    this.ranches().find(access => access.ranchId === this.currentRanchId()) ?? null);

  /** Ignores ranches outside the account's access, so a stale stored choice cannot widen scope. */
  selectRanch(ranchId: string): void {
    const accountId = this.authentication.account()?.id;
    if (!accountId || !this.ranches().some(access => access.ranchId === ranchId)) return;
    this.choice.set({ accountId, ranchId });
    writeStoredRanchId(accountId, ranchId);
  }
}

function readStoredRanchId(accountId: string): string | null {
  try {
    return localStorage.getItem(RANCH_STORAGE_PREFIX + accountId);
  } catch {
    return null;
  }
}

function writeStoredRanchId(accountId: string, ranchId: string): void {
  try {
    localStorage.setItem(RANCH_STORAGE_PREFIX + accountId, ranchId);
  } catch {
    // Storage can be disabled; the selection still applies until the page reloads.
  }
}
