import type { Money } from './plan.model';

/** The amounts of a quote or a subscription; only a quote is sure to carry the collar unit price. */
export interface PricedPurchase {
  readonly headCount: number;
  readonly annualFee: Money;
  readonly deviceUnitPrice?: Money | null;
  readonly devicesCost: Money;
  readonly total: Money;
}

export type PriceLineKind = 'collars' | 'annualFee';

/** One charge of a purchase; `amount` is the figure the API sent, never a sum computed here. */
export interface PriceLine {
  readonly kind: PriceLineKind;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly amount: Money;
}

/** Uses the API's unit price when it is sent; otherwise divides the devices cost, and display rounds the result. */
export function collarUnitPrice(priced: PricedPurchase): Money {
  if (priced.deviceUnitPrice) return priced.deviceUnitPrice;
  return { amount: priced.devicesCost.amount / priced.headCount, currency: priced.devicesCost.currency };
}

/** The two charges of a purchase in the order the screens and the receipt list them; the total stays the API's. */
export function priceLines(priced: PricedPurchase): readonly PriceLine[] {
  return [
    { kind: 'collars', quantity: priced.headCount, unitPrice: collarUnitPrice(priced), amount: priced.devicesCost },
    { kind: 'annualFee', quantity: 1, unitPrice: priced.annualFee, amount: priced.annualFee },
  ];
}
