import { formatDate } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatLocaleTag } from '../infrastructure/i18n/language';
import { LanguageService } from '../infrastructure/i18n/language.service';

/** Formats dates for the selected language; impure so each render reads the current language. */
@Pipe({ name: 'localizedDate', pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | Date | null | undefined, format = 'mediumDate'): string {
    return value ? formatDate(value, format, formatLocaleTag(this.language.current())) : '';
  }
}
