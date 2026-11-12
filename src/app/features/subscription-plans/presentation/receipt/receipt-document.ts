import { formatDate } from '@angular/common';
import type { Plan } from '../../domain/model/plan.model';
import { priceLines } from '../../domain/model/price-breakdown.model';
import { receiptKindOf, type Subscription } from '../../domain/model/subscription.model';
import { formatMoney } from '../subscription-format';

/** Looks up a translation with optional parameters; a plain function keeps the builder free of the translate service. */
export type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

export interface ReceiptSource {
  readonly subscription: Subscription;
  readonly plan: Plan;
  readonly ranchName: string;
  readonly accountEmail: string | null;
  readonly localeTag: string;
  readonly generatedOn: Date;
}

export interface ReceiptDetail {
  readonly label: string;
  readonly value: string;
}

/** A receipt or quote as final text; the PDF writer draws it and never reads the subscription. */
export interface ReceiptDocument {
  readonly fileName: string;
  readonly brand: string;
  readonly title: string;
  readonly notice: string;
  readonly details: readonly ReceiptDetail[];
  readonly headers: string[];
  readonly rows: string[][];
  readonly totalLabel: string;
  readonly total: string;
}

/** Null when the subscription has neither a quote nor a payment to show. */
export function receiptDocument(source: ReceiptSource, translate: Translate): ReceiptDocument | null {
  const { subscription, plan, localeTag, generatedOn } = source;
  const kind = receiptKindOf(subscription);
  if (kind === null) return null;

  // A quote has no payment date or validity, so only a receipt reads the activation dates.
  const paidAt = kind === 'receipt' ? subscription.activatedAt : null;
  const day = (value: string | Date): string => formatDate(value, 'mediumDate', localeTag);
  const tierName = translate('plans.tiers.' + plan.tier);

  const details: ReceiptDetail[] = [{ label: translate('receipt.ranch'), value: source.ranchName }];
  if (source.accountEmail) details.push({ label: translate('receipt.account'), value: source.accountEmail });
  details.push(
    { label: translate('plans.plan'), value: tierName },
    { label: translate('receipt.status'), value: translate('subscriptions.status.' + subscription.status) },
  );
  if (paidAt) details.push({ label: translate('receipt.paymentDate'), value: day(paidAt) });
  if (paidAt && subscription.validUntil) {
    details.push({ label: translate('receipt.validity'), value: `${day(paidAt)} – ${day(subscription.validUntil)}` });
  }
  details.push(
    { label: translate('receipt.termsVersion'), value: subscription.termsVersion },
    { label: translate('receipt.generatedOn'), value: day(generatedOn) },
  );

  const rows = priceLines(subscription).map(line => [
    line.kind === 'collars'
      ? translate('receipt.collarsItem')
      : translate('pricing.annualFeeLine', { plan: tierName }),
    String(line.quantity),
    formatMoney(line.unitPrice, localeTag),
    formatMoney(line.amount, localeTag),
  ]);

  return {
    fileName: `ichu-receipt-${plan.tier.toLowerCase()}-${formatDate(generatedOn, 'yyyy-MM-dd', 'en-US')}.pdf`,
    brand: translate('receipt.brand'),
    title: translate(kind === 'quote' ? 'receipt.quoteTitle' : 'receipt.title'),
    notice: translate('receipt.notice'),
    details,
    headers: [
      translate('receipt.description'),
      translate('receipt.quantity'),
      translate('receipt.unitPrice'),
      translate('receipt.amount'),
    ],
    rows,
    totalLabel: translate('plans.total'),
    total: formatMoney(subscription.total, localeTag),
  };
}
