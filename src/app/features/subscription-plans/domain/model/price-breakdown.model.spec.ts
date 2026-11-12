import { collarUnitPrice, type PricedPurchase, priceLines } from './price-breakdown.model';

const purchase: PricedPurchase = {
  headCount: 120,
  annualFee: { amount: 1800, currency: 'PEN' },
  devicesCost: { amount: 14400, currency: 'PEN' },
  total: { amount: 16200, currency: 'PEN' },
};

describe('price breakdown', () => {
  it('uses the collar unit price the API sends', () => {
    expect(collarUnitPrice({ ...purchase, deviceUnitPrice: { amount: 125, currency: 'PEN' } }))
      .toEqual({ amount: 125, currency: 'PEN' });
  });

  it('spreads the devices cost over the collars when the API sends no unit price', () => {
    expect(collarUnitPrice(purchase)).toEqual({ amount: 120, currency: 'PEN' });
    expect(collarUnitPrice({ ...purchase, headCount: 3, devicesCost: { amount: 100, currency: 'PEN' } }).amount)
      .toBeCloseTo(100 / 3, 6);
  });

  it('lists the collars and the annual fee with the amounts the API sent', () => {
    expect(priceLines(purchase)).toEqual([
      { kind: 'collars', quantity: 120, unitPrice: { amount: 120, currency: 'PEN' }, amount: { amount: 14400, currency: 'PEN' } },
      { kind: 'annualFee', quantity: 1, unitPrice: { amount: 1800, currency: 'PEN' }, amount: { amount: 1800, currency: 'PEN' } },
    ]);
  });
});
