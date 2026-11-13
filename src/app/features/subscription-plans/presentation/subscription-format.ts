import type { Money } from '../domain/model/plan.model';

/** Intl prints the ISO code for PEN outside Peru, while ICHU quotes its plans with the sol symbol. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { PEN: 'S/' };

/** Formats an amount the API returned with the separators of the locale and the symbol of its currency. */
export function formatMoney(money: Money, localeTag: string): string {
  const symbol = CURRENCY_SYMBOLS[money.currency];
  return new Intl.NumberFormat(localeTag, { style: 'currency', currency: money.currency })
    .formatToParts(money.amount)
    .map(part => (part.type === 'currency' && symbol ? symbol : part.value))
    .join('');
}
