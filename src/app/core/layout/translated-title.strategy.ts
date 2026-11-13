import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/** Keeps the document title in the active language, including after a language switch. */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private pageTitleKey: string | undefined;

  constructor() {
    super();
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.applyTitle());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageTitleKey = this.buildTitle(snapshot);
    this.applyTitle();
  }

  private applyTitle(): void {
    const pageTitle = this.pageTitleKey ? this.translate.instant(this.pageTitleKey) : '';
    this.title.setTitle(pageTitle ? pageTitle + ' · ICHU' : 'ICHU');
  }
}
