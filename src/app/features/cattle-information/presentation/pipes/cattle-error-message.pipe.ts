import { ChangeDetectorRef, inject, Pipe, PipeTransform } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { VERSION_CONFLICT } from '../../domain/model/cattle.model';

/** Only these generic codes have translations under `errors.*`; other failures fall back to the generic message. */
const GENERIC_ERROR_KEYS: ReadonlySet<string> = new Set([
  'network', 'configuration', 'unknown', 'http-403', 'http-404', 'http-409', 'http-500',
]);

/** Localizes animal and lot failures; impure so the message follows a language switch. */
@Pipe({ name: 'cattleError', pure: false })
export class CattleErrorMessagePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  constructor() {
    const changeDetector = inject(ChangeDetectorRef);
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => changeDetector.markForCheck());
  }

  transform(error: ApiError | null | undefined): string {
    if (!error) return '';
    if (error.code === VERSION_CONFLICT) return this.translate.instant('cattle.errors.versionConflict');
    // The backend title is already localized through Accept-Language.
    if (error.title) return error.title;
    return this.translate.instant(GENERIC_ERROR_KEYS.has(error.code) ? 'errors.' + error.code : 'errors.unknown');
  }
}
