import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { IamContextFacade } from '../../../application/acl/iam-context.facade';
import { HerdAdvisoriesFacade } from '../../../application/services/herd-advisories.facade';
import { AuthFacade } from '../../../application/services/auth.facade';
import type { AdvisoryStatus, DecideHerdAdvisory, HerdAdvisoryRecord } from '../../../domain/model/herd-advisory.model';
import { ConfirmDialog, type ConfirmDialogData } from '../../../../../shared/presentation/confirm-dialog';
import { LocalizedDatePipe } from '../../../../../shared/presentation/localized-date.pipe';
import {
  HerdAdvisoryDecisionDialog,
  type HerdAdvisoryDecisionData,
} from '../../components/herd-advisory-decision-dialog';
import { ranchPlace, scopeLabelKey, statusLabelKey, statusTone } from '../../iam-labels';
import { ErrorMessagePipe } from '../../pipes/error-message.pipe';

// The code alphabet omits look-alike characters (I, O, 0, 1), so most typing mistakes fail before a lookup.
const ACCESS_CODE_PATTERN = /^[A-HJ-NP-Za-hj-np-z2-9]{8}$/;

type AdvisoryFilter = 'all' | AdvisoryStatus;

const FILTERS: readonly AdvisoryFilter[] = ['all', 'Pending', 'Granted', 'Rejected', 'Revoked', 'Expired'];

const DISPLAYED_COLUMNS = ['veterinarian', 'reason', 'status', 'requestedAt', 'expiresAt', 'actions'];

/** Lets veterinarians request ranch access by code, and managers review requests for the ranch they manage. */
@Component({
  selector: 'ichu-herd-advisories-page',
  imports: [
    LocalizedDatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ErrorMessagePipe,
  ],
  providers: [HerdAdvisoriesFacade],
  templateUrl: './herd-advisories-page.html',
  styleUrl: './herd-advisories-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HerdAdvisoriesPage {
  readonly auth = inject(AuthFacade);
  readonly context = inject(IamContextFacade);
  readonly facade = inject(HerdAdvisoriesFacade);
  private readonly dialog = inject(MatDialog);
  readonly filters = FILTERS;
  readonly displayedColumns = DISPLAYED_COLUMNS;
  readonly statusFilter = signal<AdvisoryFilter>('all');
  readonly visibleRecords = computed(() => {
    const filter = this.statusFilter();
    return filter === 'all' ? this.facade.records() : this.facade.records().filter(record => record.status === filter);
  });
  readonly statusLabelKey = statusLabelKey;
  readonly statusTone = statusTone;
  readonly scopeLabelKey = scopeLabelKey;
  readonly ranchPlace = ranchPlace;

  readonly lookupForm = new FormGroup({
    accessCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ACCESS_CODE_PATTERN)],
    }),
  });

  readonly reasonForm = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
    }),
  });

  constructor() {
    // An edited code must not keep the previous ranch match, or the request could target the wrong ranch.
    this.lookupForm.controls.accessCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.facade.clearLookup());
  }

  /** Looks up the ranch behind the entered code; the reason step appears once a ranch matches. */
  async findRanch(): Promise<void> {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    await this.facade.findRanch(this.lookupForm.getRawValue().accessCode.trim());
  }

  /** Sends the reason for the ranch that was found, and clears both steps once the request is accepted. */
  async requestAccess(): Promise<void> {
    if (this.reasonForm.invalid) {
      this.reasonForm.markAllAsTouched();
      return;
    }
    if (await this.facade.requestAccess(this.reasonForm.getRawValue().reason.trim())) {
      this.lookupForm.reset({ accessCode: '' });
      this.reasonForm.reset({ reason: '' });
    }
  }

  /** Opens the decision dialog for a pending request and applies the decision it returns. */
  async review(record: HerdAdvisoryRecord): Promise<void> {
    const reference = this.dialog.open<HerdAdvisoryDecisionDialog, HerdAdvisoryDecisionData, DecideHerdAdvisory | undefined>(
      HerdAdvisoryDecisionDialog,
      { data: { advisory: record }, width: '520px', maxWidth: 'calc(100vw - 32px)', panelClass: 'ichu-workspace-dialog' },
    );
    const decision = await firstValueFrom(reference.afterClosed());
    if (decision) await this.facade.decide(record.id, decision);
  }

  /** Confirms before revoking a granted ranch access, because the veterinarian loses it at once. */
  async revoke(record: HerdAdvisoryRecord): Promise<void> {
    const data: ConfirmDialogData = {
      titleKey: 'iam.advisories.revokeTitle',
      bodyKey: 'iam.advisories.revokeBody',
      confirmKey: 'iam.advisories.revoke',
    };
    const reference = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      role: 'alertdialog',
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'ichu-workspace-dialog',
    });
    if (await firstValueFrom(reference.afterClosed())) {
      await this.facade.decide(record.id, { decision: 'revoke' });
    }
  }
}
