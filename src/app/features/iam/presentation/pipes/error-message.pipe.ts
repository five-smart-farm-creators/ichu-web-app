import { ChangeDetectorRef, inject, Pipe, PipeTransform } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { AuthError } from '../../domain/model/auth.model';

/** Only these codes have translations under `errors.*`; any other backend code falls back to the generic message. */
const API_ERROR_KEYS = new Set(['network', 'configuration', 'unknown', 'http-403', 'http-404', 'http-409', 'http-500']);

/** Localizes authentication and API failures; impure so the message follows a language switch. */
@Pipe({ name: 'errorMessage', pure: false })
export class ErrorMessagePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  constructor() {
    const changeDetector = inject(ChangeDetectorRef);
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => changeDetector.markForCheck());
  }

  transform(error: AuthError | ApiError | string | null | undefined): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof AuthError) return this.translate.instant('iam.errors.' + error.code);
    // The backend title is already localized through Accept-Language.
    if (error.title) return error.title;
    return this.translate.instant(API_ERROR_KEYS.has(error.code) ? 'errors.' + error.code : 'errors.unknown');
  }
}
