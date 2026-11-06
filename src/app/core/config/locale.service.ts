import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type AppLocale = 'en_US' | 'es_419';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  readonly locale = signal<AppLocale>(this.restore());

  constructor() {
    effect(() => { this.document.documentElement.lang = this.locale().replace('_', '-'); });
  }

  text(english: string, spanish: string): string {
    return this.locale() === 'es_419' ? spanish : english;
  }

  setLocale(value: string): void {
    if (value !== 'en_US' && value !== 'es_419') return;
    this.locale.set(value);
    try {
      this.document.defaultView?.localStorage.setItem('ichu.locale', value);
    } catch {
      // Selection remains available when browser storage is disabled.
    }
  }

  date(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const date = typeof value === 'string'
      ? new Date(value.length === 10 ? `${value}T12:00:00-05:00` : value)
      : value;
    if (!Number.isFinite(date.getTime())) return this.text('No date', 'Sin fecha');
    const defaults: Intl.DateTimeFormatOptions = options?.dateStyle || options?.timeStyle
      ? {} : { month: 'short', day: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat(this.locale().replace('_', '-'), {
      timeZone: 'America/Lima', ...defaults, ...options,
    }).format(date);
  }

  number(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.locale().replace('_', '-'), options).format(value);
  }

  private restore(): AppLocale {
    try {
      const saved = this.document.defaultView?.localStorage.getItem('ichu.locale');
      return saved === 'es_419' ? 'es_419' : 'en_US';
    } catch {
      return 'en_US';
    }
  }
}
