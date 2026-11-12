import type { Plan } from '../../domain/model/plan.model';
import type { Subscription } from '../../domain/model/subscription.model';
import { formatMoney } from '../subscription-format';
import { receiptDocument, type ReceiptSource } from './receipt-document';

const sol = (amount: number): string => formatMoney({ amount, currency: 'PEN' }, 'en-US');
const translate = (key: string): string => key;

const standard: Plan = {
  id: 'plan-standard',
  tier: 'Standard',
  name: 'Standard',
  deviceLimit: 200,
  annualFee: { amount: 1800, currency: 'PEN' },
  deviceUnitPrice: { amount: 120, currency: 'PEN' },
  features: ['Monitoring'],
};

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'subscription-1',
    ranchId: 'ranch-1',
    planId: 'plan-standard',
    status: 'Active',
    headCount: 40,
    annualFee: { amount: 1800, currency: 'PEN' },
    devicesCost: { amount: 4800, currency: 'PEN' },
    total: { amount: 6600, currency: 'PEN' },
    termsVersion: '2026-11',
    requestedAt: '2026-11-10T10:00:00',
    activatedAt: '2026-11-11T10:05:00',
    validUntil: '2027-11-11T10:05:00',
    cancelledAt: null,
    cancellationReason: null,
    maximumDevices: 200,
    features: ['Monitoring'],
    ...overrides,
  };
}

function source(overrides: Partial<ReceiptSource> = {}): ReceiptSource {
  return {
    subscription: subscription(),
    plan: standard,
    ranchName: 'North Pasture',
    accountEmail: 'manager@example.test',
    localeTag: 'en-US',
    generatedOn: new Date(2026, 10, 12, 9, 30),
    ...overrides,
  };
}

describe('receiptDocument', () => {
  it('lists the collars and the annual fee, then the total the subscription carries', () => {
    const document = receiptDocument(source(), translate);

    expect(document?.rows).toEqual([
      ['receipt.collarsItem', '40', sol(120), sol(4800)],
      ['pricing.annualFeeLine', '1', sol(1800), sol(1800)],
    ]);
    expect(document?.totalLabel).toBe('plans.total');
    expect(document?.total).toBe(sol(6600));
  });

  it('takes the collar unit price from the API when it is sent', () => {
    const document = receiptDocument(source({
      subscription: subscription({
        devicesCost: { amount: 5000, currency: 'PEN' },
        total: { amount: 6800, currency: 'PEN' },
        deviceUnitPrice: { amount: 125, currency: 'PEN' },
      }),
    }), translate);

    expect(document?.rows[0]).toEqual(['receipt.collarsItem', '40', sol(125), sol(5000)]);
  });

  it('derives the collar unit price from the devices cost when the API sends none', () => {
    const document = receiptDocument(source({
      subscription: subscription({
        headCount: 3,
        devicesCost: { amount: 100, currency: 'PEN' },
        total: { amount: 1900, currency: 'PEN' },
      }),
    }), translate);

    expect(document?.rows[0]).toEqual(['receipt.collarsItem', '3', sol(100 / 3), sol(100)]);
  });

  it('gives a paid subscription its payment date, validity and file name by plan and day', () => {
    const document = receiptDocument(source(), translate);

    expect(document?.title).toBe('receipt.title');
    expect(document?.details).toEqual([
      { label: 'receipt.ranch', value: 'North Pasture' },
      { label: 'receipt.account', value: 'manager@example.test' },
      { label: 'plans.plan', value: 'plans.tiers.Standard' },
      { label: 'receipt.status', value: 'subscriptions.status.Active' },
      { label: 'receipt.paymentDate', value: 'Nov 11, 2026' },
      { label: 'receipt.validity', value: 'Nov 11, 2026 – Nov 11, 2027' },
      { label: 'receipt.termsVersion', value: '2026-11' },
      { label: 'receipt.generatedOn', value: 'Nov 12, 2026' },
    ]);
    expect(document?.fileName).toBe('ichu-receipt-standard-2026-11-12.pdf');
  });

  it('gives a pending subscription a quote without a payment date or validity', () => {
    const document = receiptDocument(source({
      subscription: subscription({ status: 'Pending', activatedAt: null, validUntil: null }),
    }), translate);

    expect(document?.title).toBe('receipt.quoteTitle');
    expect(document?.details.map(detail => detail.label)).not.toContain('receipt.paymentDate');
    expect(document?.details.map(detail => detail.label)).not.toContain('receipt.validity');
    expect(document?.fileName).toBe('ichu-receipt-standard-2026-11-12.pdf');
  });

  it('leaves out the account row when no email is known', () => {
    const document = receiptDocument(source({ accountEmail: null }), translate);

    expect(document?.details.map(detail => detail.label)).not.toContain('receipt.account');
  });

  it('issues nothing for a subscription that was cancelled before any payment', () => {
    expect(receiptDocument(source({ subscription: subscription({ status: 'Cancelled', activatedAt: null }) }), translate))
      .toBeNull();
  });
});
