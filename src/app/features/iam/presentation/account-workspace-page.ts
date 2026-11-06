import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  AccessScope,
  DecideHerdAdvisory,
  GrantHerdAdvisory,
  HerdAdvisoryRecord,
  RequestHerdAdvisory,
} from '../domain/model/herd-advisory.model';
import { AccountWorkspaceFacade } from '../application/services/account-workspace.facade';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const futureDateValidator: ValidatorFn = control => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value) {
    return null;
  }
  const expiration = Date.parse(value + 'T23:59:59.999Z');
  return Number.isFinite(expiration) && expiration > Date.now() ? null : { futureDate: true };
};

/** Presents verified account details and role-authorized ranch advisory actions. */
@Component({
  selector: 'ichu-account-workspace-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  providers: [AccountWorkspaceFacade],
  templateUrl: './account-workspace-page.html',
  styleUrl: './account-workspace-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountWorkspacePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly facade = inject(AccountWorkspaceFacade);
  readonly isAdvisoriesPage = this.route.snapshot.routeConfig?.path === 'advisories';
  readonly minimumExpiryDate = this.localDateString(new Date());
  readonly ranchSelectionControl = new FormControl('', { nonNullable: true });
  readonly reviewedAdvisoryId = signal<string | null>(null);
  readonly reviewedAdvisory = computed(() => {
    const id = this.reviewedAdvisoryId();
    return id ? this.facade.advisories().find(record => record.id === id) ?? null : null;
  });

  readonly professionalProfileForm = new FormGroup({
    specialty: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)],
    }),
    licenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)],
    }),
    yearsOfExperience: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  readonly requestForm = new FormGroup({
    ranchId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
  });

  readonly directGrantForm = new FormGroup({
    ranchId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    veterinarianId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    scope: new FormControl<AccessScope>('Read', { nonNullable: true, validators: [Validators.required] }),
    expiresOn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, futureDateValidator],
    }),
  });

  readonly decisionForm = new FormGroup({
    scope: new FormControl<AccessScope>('Read', { nonNullable: true, validators: [Validators.required] }),
    expiresOn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, futureDateValidator],
    }),
  });

  ngOnInit(): void {
    void this.prepareWorkspace();
  }

  /** Saves only validated profile fields through the professional-profile port. */
  async saveProfessionalProfile(): Promise<void> {
    if (this.professionalProfileForm.invalid) {
      this.professionalProfileForm.markAllAsTouched();
      return;
    }
    const values = this.professionalProfileForm.getRawValue();
    await this.facade.saveProfessionalProfile({
      specialty: values.specialty.trim(),
      licenseNumber: values.licenseNumber.trim(),
      yearsOfExperience: values.yearsOfExperience,
    });
  }

  /** Submits a veterinarian's request using the selected ranch UUID and reason. */
  async submitAccessRequest(): Promise<void> {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    const values = this.requestForm.getRawValue();
    const request: RequestHerdAdvisory = {
      ranchId: values.ranchId.trim(),
      reason: values.reason.trim(),
    };
    if (await this.facade.requestAccess(request)) {
      this.requestForm.reset({ ranchId: '', reason: '' });
    }
  }

  /** Loads advisory records for the selected authorized ranch. */
  async loadSelectedRanch(): Promise<void> {
    const ranchId = this.ranchSelectionControl.value;
    if (ranchId) {
      await this.facade.loadAdvisories(ranchId);
    }
  }

  /** Prepares a manager-issued grant for an authorized ranch. */
  async submitDirectGrant(): Promise<void> {
    if (this.directGrantForm.invalid) {
      this.directGrantForm.markAllAsTouched();
      return;
    }
    const values = this.directGrantForm.getRawValue();
    const grant: GrantHerdAdvisory = {
      ranchId: values.ranchId,
      veterinarianId: values.veterinarianId.trim(),
      scope: values.scope,
      expiresAt: this.expirationTimestamp(values.expiresOn),
    };
    if (await this.facade.grantAccess(grant)) {
      this.directGrantForm.reset({
        ranchId: values.ranchId,
        veterinarianId: '',
        scope: 'Read',
        expiresOn: '',
      });
    }
  }

  /** Opens the decision form for a pending request. */
  reviewRequest(record: HerdAdvisoryRecord): void {
    if (this.statusCode(record.status) !== 'pending') {
      return;
    }
    this.reviewedAdvisoryId.set(record.id);
    this.decisionForm.reset({ scope: 'Read', expiresOn: '' });
  }

  /** Grants a pending request with the chosen scope and expiration date. */
  async grantReviewedRequest(): Promise<void> {
    const record = this.reviewedAdvisory();
    if (!record || this.decisionForm.invalid) {
      this.decisionForm.markAllAsTouched();
      return;
    }
    const values = this.decisionForm.getRawValue();
    const decision: DecideHerdAdvisory = {
      decision: 'grant',
      scope: values.scope,
      expiresAt: this.expirationTimestamp(values.expiresOn),
    };
    if (await this.facade.decideAdvisory(record.id, decision)) {
      this.reviewedAdvisoryId.set(null);
    }
  }

  /** Rejects the selected pending request through the advisory repository. */
  async rejectReviewedRequest(): Promise<void> {
    const record = this.reviewedAdvisory();
    if (!record || this.statusCode(record.status) !== 'pending') {
      return;
    }
    if (await this.facade.decideAdvisory(record.id, { decision: 'reject' })) {
      this.reviewedAdvisoryId.set(null);
    }
  }

  /** Revokes a granted ranch advisory through the advisory repository. */
  async revokeAccess(record: HerdAdvisoryRecord): Promise<void> {
    if (this.statusCode(record.status) === 'granted') {
      await this.facade.decideAdvisory(record.id, { decision: 'revoke' });
    }
  }

  /** Closes the pending-request review form. */
  cancelReview(): void {
    this.reviewedAdvisoryId.set(null);
  }

  /** Signs out and returns the user to the integrated login route. */
  async signOut(): Promise<void> {
    if (await this.facade.signOut()) {
      await this.router.navigateByUrl('/login');
    }
  }

  /** Maps known backend roles to readable labels while preserving unknown values. */
  roleLabel(role: string): string {
    switch (role) {
      case 'RanchManager':
        return 'Ranch manager';
      case 'FieldOperator':
        return 'Field operator';
      case 'Veterinarian':
        return 'Veterinarian';
      default:
        return role;
    }
  }

  /** Returns a shared badge tone for a backend advisory status. */
  statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (this.statusCode(status)) {
      case 'granted':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
      case 'revoked':
      case 'expired':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  statusCode(status: string): string {
    return status.trim().toLowerCase();
  }

  private async prepareWorkspace(): Promise<void> {
    await this.facade.initialize(this.isAdvisoriesPage);
    const profile = this.facade.account()?.profile;
    if (profile) {
      this.professionalProfileForm.patchValue(profile);
    }
    this.ranchSelectionControl.setValue(this.facade.selectedRanchId());
    const firstManageableRanch = this.facade.manageableRanches()[0];
    if (firstManageableRanch) {
      this.directGrantForm.controls.ranchId.setValue(firstManageableRanch.ranchId);
    }
  }

  private expirationTimestamp(date: string): string {
    return date + 'T23:59:59.999Z';
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
}
