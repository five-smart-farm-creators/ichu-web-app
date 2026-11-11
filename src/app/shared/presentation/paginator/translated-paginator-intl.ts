import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/** Translates paginator controls; the range omits a total because server-paged lists do not report one. */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const start = page * pageSize + 1;
    if (length === 0 || start > length) return '0';
    const end = Math.min(start + pageSize - 1, length);
    return this.translate.instant('common.paginator.range', { start, end });
  };

  constructor() {
    super();
    this.applyLabels();
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => {
      this.applyLabels();
      this.changes.next();
    });
  }

  private applyLabels(): void {
    this.itemsPerPageLabel = this.translate.instant('common.paginator.itemsPerPage');
    this.nextPageLabel = this.translate.instant('common.paginator.next');
    this.previousPageLabel = this.translate.instant('common.paginator.previous');
    this.firstPageLabel = this.translate.instant('common.paginator.first');
    this.lastPageLabel = this.translate.instant('common.paginator.last');
  }
}
