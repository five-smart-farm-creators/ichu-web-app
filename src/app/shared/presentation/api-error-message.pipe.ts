import { ChangeDetectorRef, inject, Pipe, PipeTransform } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ApiError } from '../infrastructure/http/api-error';

/** Only these generic codes have translations under `errors.*`; other failures fall back to the generic message. */
const GENERIC_ERROR_KEYS: ReadonlySet<string> = new Set([
  'network', 'configuration', 'unknown', 'http-403', 'http-404', 'http-409', 'http-500',
]);

/** Translation keys for one bounded context's own error codes, such as its version conflict. */
export type ContextErrorKeys = ReadonlyMap<string, string>;

const NO_CONTEXT_KEYS: ContextErrorKeys = new Map();

/** Localizes API failures; a context's own codes win, and the message follows a language switch. */
@Pipe({ name: 'apiErrorMessage', pure: false })
export class ApiErrorMessagePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  constructor() {
    const changeDetector = inject(ChangeDetectorRef);
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => changeDetector.markForCheck());
  }

  transform(error: ApiError | null | undefined, contextKeys: ContextErrorKeys = NO_CONTEXT_KEYS): string {
    if (!error) return '';
    const contextKey = contextKeys.get(error.code);
    if (contextKey) return this.translate.instant(contextKey);
    // The backend title is already localized through Accept-Language.
    if (error.title) return error.title;
    return this.translate.instant(GENERIC_ERROR_KEYS.has(error.code) ? 'errors.' + error.code : 'errors.unknown');
  }
}
