import type { Plan } from '../../domain/model/plan.model';
import type { Subscription } from '../../domain/model/subscription.model';
import { formatMoney } from '../subscription-format';
import { receiptDocument, type ReceiptDocument, type ReceiptSource } from './receipt-document';
import { renderReceiptPdf } from './receipt-pdf';

const mocks = vi.hoisted(() => {
  const document = {
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    save: vi.fn(),
  };
  return {
    document,
    jsPDF: vi.fn(function () {
      return document;
    }),
    autoTable: vi.fn(),
  };
});

vi.mock('jspdf', () => ({ jsPDF: mocks.jsPDF }));
vi.mock('jspdf-autotable', () => ({ default: mocks.autoTable }));

const sol = (amount: number): string => formatMoney({ amount, currency: 'PEN' }, 'en-US');
const translate = (key: string): string => key;

const standard: Plan = {
  id: 'plan-secret-standard',
  tier: 'Standard',
  name: 'Standard',
  deviceLimit: 200,
  annualFee: { amount: 1800, currency: 'PEN' },
  deviceUnitPrice: { amount: 120, currency: 'PEN' },
  features: ['Monitoring'],
};

const paid: Subscription = {
  id: 'subscription-secret-1',
  ranchId: 'ranch-secret-1',
  planId: 'plan-secret-standard',
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
};

function documentOf(subscription: Subscription): ReceiptDocument {
  const source: ReceiptSource = {
    subscription,
    plan: standard,
    ranchName: 'North Pasture',
    accountEmail: 'manager@example.test',
    localeTag: 'en-US',
    generatedOn: new Date(2026, 10, 12, 9, 30),
  };
  const document = receiptDocument(source, translate);
  if (!document) throw new Error('The subscription has neither a quote nor a receipt.');
  return document;
}

/** Every line the writer drew or put in the table, so the assertions read the page the way a reader would. */
function printed(): string {
  const drawn = mocks.document.text.mock.calls.flatMap(([content]) => (Array.isArray(content) ? content : [content]));
  const [, options] = mocks.autoTable.mock.calls[0];
  const cells = [...options.head, ...options.body, ...options.foot]
    .flat()
    .map(cell => (typeof cell === 'object' ? cell.content : cell));
  return [...drawn, ...cells].join('\n');
}

describe('renderReceiptPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('draws a paid subscription as a receipt with its lines, total and file name', async () => {
    await renderReceiptPdf(documentOf(paid));

    expect(printed()).toContain('receipt.title');
    expect(printed()).not.toContain('receipt.quoteTitle');
    expect(printed()).toContain('receipt.paymentDate');
    expect(printed()).toContain('Nov 11, 2026 – Nov 11, 2027');
    const [, options] = mocks.autoTable.mock.calls[0];
    expect(options.head).toEqual([['receipt.description', 'receipt.quantity', 'receipt.unitPrice', 'receipt.amount']]);
    expect(options.body).toEqual([
      ['receipt.collarsItem', '40', sol(120), sol(4800)],
      ['pricing.annualFeeLine', '1', sol(1800), sol(1800)],
    ]);
    expect(options.foot).toEqual([[{ content: 'plans.total', colSpan: 3, styles: { halign: 'right' } }, sol(6600)]]);
    expect(mocks.document.save).toHaveBeenCalledWith('ichu-receipt-standard-2026-11-12.pdf');
  });

  it('draws a pending subscription as a quote without a payment date or validity', async () => {
    await renderReceiptPdf(documentOf({ ...paid, status: 'Pending', activatedAt: null, validUntil: null }));

    expect(printed()).toContain('receipt.quoteTitle');
    expect(printed()).not.toContain('receipt.title');
    expect(printed()).not.toContain('receipt.paymentDate');
    expect(printed()).not.toContain('receipt.validity');
    const [, options] = mocks.autoTable.mock.calls[0];
    expect(options.foot[0][1]).toBe(sol(6600));
    expect(mocks.document.save).toHaveBeenCalledWith('ichu-receipt-standard-2026-11-12.pdf');
  });

  it('prints no identifier of the ranch, the plan or the subscription', async () => {
    await renderReceiptPdf(documentOf(paid));

    expect(printed()).not.toMatch(/secret/);
    expect(JSON.stringify(mocks.autoTable.mock.calls[0][1])).not.toMatch(/secret/);
    expect(mocks.document.save.mock.calls[0][0]).not.toMatch(/secret/);
  });
});
