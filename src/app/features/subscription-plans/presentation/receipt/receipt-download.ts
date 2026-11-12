import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { currentRanchLabel } from '../../../../core/layout/ranch-label';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../iam/application/acl/iam-context.facade';
import type { Plan } from '../../domain/model/plan.model';
import type { Subscription } from '../../domain/model/subscription.model';
import { receiptDocument } from './receipt-document';
import { renderReceiptPdf } from './receipt-pdf';

/** Saves the receipt or quote of a subscription; the amounts are the ones the subscription resource carries. */
@Injectable()
export class ReceiptDownload {
  private readonly translate = inject(TranslateService);
  private readonly context = inject(IamContextFacade);
  private readonly language = inject(LanguageService);
  readonly busy = signal(false);
  readonly failed = signal(false);

  /** A failure is shown on the page, so the visitor can try again. */
  async download(subscription: Subscription, plan: Plan): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      const receipt = receiptDocument({
        subscription,
        plan,
        ranchName: currentRanchLabel(this.context, this.translate),
        accountEmail: this.context.currentAccountEmail(),
        localeTag: formatLocaleTag(this.language.current()),
        generatedOn: new Date(),
      }, (key, params) => this.translate.instant(key, params));
      if (receipt) await renderReceiptPdf(receipt);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
