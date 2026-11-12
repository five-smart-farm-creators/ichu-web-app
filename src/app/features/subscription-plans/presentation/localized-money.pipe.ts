import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatLocaleTag } from '../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../shared/infrastructure/i18n/language.service';
import type { Money } from '../domain/model/plan.model';
import { formatMoney } from './subscription-format';

/** Formats an amount the API returned for the selected language; impure so each render reads the current language. */
@Pipe({ name: 'localizedMoney', pure: false })
export class LocalizedMoneyPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: Money | null | undefined): string {
    return value ? formatMoney(value, formatLocaleTag(this.language.current())) : '';
  }
}
