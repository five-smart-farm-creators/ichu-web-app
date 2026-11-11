import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { AuthError, type AuthUser, type IamAccount, type RanchAccess, type RegisterAccountRequest } from '../../domain/model/auth.model';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';

/** Coordinates Firebase identity with the backend account and ranch-access contracts. */
@Injectable()
export class AuthFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authentication = inject(AuthenticationRepository);
  private readonly accounts = inject(AccountRepository);
  private readonly validationByUid = new Map<string, Promise<void>>();
  private readonly initialState: Promise<void>;
  private resolveInitialState: () => void = () => undefined;
  private stopObserving: (() => void) | null = null;
  private registrationInProgress = false;
  private initialStateResolved = false;
  private stateGeneration = 0;
  private suppressedUid: string | null = null;

  readonly authenticated = signal(false);
  readonly currentUser = signal<AuthUser | null>(null);
  readonly account = signal<IamAccount | null>(null);
  readonly ranchAccess = signal<readonly RanchAccess[]>([]);
  readonly loading = signal(true);
  readonly readyState = signal(false);
  readonly busy = signal(false);
  readonly error = signal<AuthError | ApiError | null>(null);
  /** True when an identity exists but its ICHU setup is unfinished, so the same credentials can finish it. */
  readonly registrationRetryable = signal(false);
  readonly displayName = computed(() => this.currentUser()?.displayName?.trim() || null);
  readonly name = computed(() => this.displayName() || this.currentUser()?.email || '');

  constructor() {
    this.initialState = new Promise(resolve => { this.resolveInitialState = resolve; });
    if (!this.authentication.isConfigured()) {
      this.error.set(new AuthError('configuration'));
      this.finishInitialState();
      return;
    }
    try {
      this.stopObserving = this.authentication.observeAuthState(
        user => { void this.handleAuthState(user); },
        error => this.handleAuthError(error),
      );
      this.destroyRef.onDestroy(() => this.stopObserving?.());
    } catch (error) {
      this.handleAuthError(error instanceof AuthError ? error : new AuthError('unknown'));
    }
  }

  /** Resolves after Firebase's initial state and backend account check complete. */
  ready(): Promise<void> {
    return this.initialState;
  }

  /** Signs in with Firebase, then opens the app only if the matching ICHU account is usable. */
  async signIn(email: string, password: string): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    this.stateGeneration++;
    this.clearAuthenticatedState();
    let signedInUser: AuthUser | null = null;
    try {
      this.requireRuntimeConfiguration();
      this.suppressedUid = null;
      signedInUser = await this.authentication.signIn(email.trim(), password);
      await this.verifyApplicationAccount(signedInUser);
      return this.authenticated();
    } catch (error) {
      const userError = this.asUserError(error);
      if (signedInUser && this.authentication.currentUser()?.uid === signedInUser.uid) {
        await this.authentication.signOut().catch(() => undefined);
        this.clearAuthenticatedState();
      }
      this.error.set(userError);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Creates a Firebase identity and provisions its backend account before sending verification email. */
  async register(
    email: string,
    password: string,
    displayName: string,
    request: RegisterAccountRequest,
  ): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    this.registrationRetryable.set(false);
    this.registrationInProgress = true;
    this.stateGeneration++;
    this.clearAuthenticatedState();
    let createdIdentity = false;
    let openedIdentitySession = false;
    let provisioningStarted = false;
    let accountProvisioned = false;
    try {
      this.requireRuntimeConfiguration();
      try {
        await this.authentication.createUser(email.trim(), password);
        createdIdentity = true;
      } catch (error) {
        if (!(error instanceof AuthError) || error.code !== 'email-already-in-use') throw error;
        await this.authentication.signIn(email.trim(), password);
      }
      openedIdentitySession = true;
      this.suppressedUid = this.authentication.currentUser()?.uid ?? null;
      if (createdIdentity) await this.authentication.updateDisplayName(displayName.trim());
      provisioningStarted = true;
      try {
        await this.accounts.registerAccount(request);
      } catch (error) {
        // Retrying verification is safe only after credentials prove ownership of the identity.
        if (createdIdentity || !(error instanceof AuthError) || error.code !== 'account-unavailable'
          || this.authentication.currentUser()?.emailVerified) throw error;
      }
      accountProvisioned = true;
      try {
        await this.authentication.sendEmailVerification();
      } catch {
        this.registrationRetryable.set(true);
        throw new AuthError('service-unavailable');
      }
      await this.authentication.signOut();
      this.clearAuthenticatedState();
      return true;
    } catch (error) {
      if (openedIdentitySession) {
        this.suppressedUid = this.authentication.currentUser()?.uid ?? this.suppressedUid;
        await this.authentication.signOut().catch(() => undefined);
        this.clearAuthenticatedState();
      }
      if (openedIdentitySession && provisioningStarted && !accountProvisioned
        && !(error instanceof AuthError && error.code === 'account-unavailable')) {
        this.registrationRetryable.set(true);
      }
      this.error.set(this.asUserError(error));
      return false;
    } finally {
      this.registrationInProgress = false;
      this.busy.set(false);
      this.finishInitialState();
    }
  }

  /** Sends a Firebase password-reset email without retaining the address. */
  async sendPasswordReset(email: string): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!this.authentication.isConfigured()) throw this.configurationError();
      await this.authentication.sendPasswordReset(email.trim());
      return true;
    } catch (error) {
      this.error.set(this.asUserError(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Signs out of Firebase and clears the backend account snapshot. */
  async signOut(): Promise<void> {
    this.stateGeneration++;
    this.clearAuthenticatedState();
    this.error.set(null);
    this.busy.set(true);
    try {
      if (this.authentication.isConfigured()) {
        this.suppressedUid = this.authentication.currentUser()?.uid ?? null;
        await this.authentication.signOut();
      }
    } catch (error) {
      this.error.set(this.asUserError(error));
    } finally {
      this.clearAuthenticatedState();
      this.busy.set(false);
    }
  }

  private async handleAuthState(user: AuthUser | null): Promise<void> {
    // Registration owns the identity until provisioning and verification delivery finish.
    if (this.registrationInProgress) return;
    const generation = ++this.stateGeneration;
    if (user && user.uid === this.suppressedUid) {
      if (this.authentication.currentUser()?.uid === user.uid) {
        await this.authentication.signOut().catch(() => undefined);
      }
      return;
    }
    this.clearAuthenticatedState();
    if (!user) {
      this.finishInitialState();
      return;
    }
    this.loading.set(true);
    try {
      await this.verifyApplicationAccount(user);
      if (generation === this.stateGeneration) this.error.set(null);
    } catch (error) {
      if (generation !== this.stateGeneration) return;
      if (this.authentication.currentUser()?.uid === user.uid) {
        this.error.set(this.asUserError(error));
        await this.authentication.signOut().catch(() => undefined);
      }
      if (generation === this.stateGeneration) this.clearAuthenticatedState();
    } finally {
      if (generation === this.stateGeneration) this.finishInitialState();
    }
  }

  private async verifyApplicationAccount(user: AuthUser): Promise<void> {
    const key = `${user.uid}:${this.stateGeneration}`;
    const pending = this.validationByUid.get(key);
    if (pending) return pending;
    const validation = this.loadApplicationAccount(user);
    this.validationByUid.set(key, validation);
    try {
      await validation;
    } finally {
      if (this.validationByUid.get(key) === validation) this.validationByUid.delete(key);
    }
  }

  private async loadApplicationAccount(user: AuthUser): Promise<void> {
    const generation = this.stateGeneration;
    if (!user.emailVerified) {
      throw new AuthError('email-not-verified');
    }
    if (this.authentication.currentUser()?.uid !== user.uid) {
      throw new AuthError('account-unavailable');
    }
    const [account, ranchAccess] = await Promise.all([
      this.accounts.currentAccount(),
      this.accounts.ranchAccess(),
    ]);
    if (generation !== this.stateGeneration || this.registrationInProgress || user.uid === this.suppressedUid
      || this.authentication.currentUser()?.uid !== user.uid
      || account.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new AuthError('account-unavailable');
    }
    if (account.status.trim().toLowerCase() !== 'active') {
      throw new AuthError('account-unavailable');
    }
    this.currentUser.set(user);
    this.account.set(account);
    this.ranchAccess.set(ranchAccess);
    this.authenticated.set(true);
  }

  private handleAuthError(error: AuthError): void {
    this.error.set(error);
    this.clearAuthenticatedState();
    this.loading.set(false);
    this.finishInitialState();
  }

  private requireRuntimeConfiguration(): void {
    if (!this.authentication.isConfigured() || !this.accounts.isConfigured()) throw this.configurationError();
  }

  private configurationError(): AuthError {
    return new AuthError('configuration');
  }

  private asUserError(error: unknown): AuthError | ApiError {
    return error instanceof AuthError || error instanceof ApiError ? error : new AuthError('unknown');
  }

  private clearAuthenticatedState(): void {
    this.authenticated.set(false);
    this.currentUser.set(null);
    this.account.set(null);
    this.ranchAccess.set([]);
  }

  private finishInitialState(): void {
    this.loading.set(false);
    this.readyState.set(true);
    if (!this.initialStateResolved) {
      this.initialStateResolved = true;
      this.resolveInitialState();
    }
  }
}
