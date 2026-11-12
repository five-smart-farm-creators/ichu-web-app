import { formatMoney } from './subscription-format';

describe('formatMoney', () => {
  // Intl separates the symbol from the amount with a no-break space, which keeps them on one line.
  it('prints soles with the sol symbol and the separators of each language', () => {
    expect(formatMoney({ amount: 1800, currency: 'PEN' }, 'en-US')).toBe('S/ 1,800.00');
    expect(formatMoney({ amount: 16200.5, currency: 'PEN' }, 'es-419')).toBe('S/ 16,200.50');
  });

  it('keeps the symbol that Intl chooses for other currencies', () => {
    expect(formatMoney({ amount: 12.5, currency: 'USD' }, 'en-US')).toBe('$12.50');
  });
});
