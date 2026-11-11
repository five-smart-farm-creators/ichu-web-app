import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'ichu-not-found-page',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="empty-state"><span class="eyebrow">404</span><h1>{{ 'pages.notFound' | translate }}</h1>
    <p>{{ 'notFound.body' | translate }}</p>
    <a class="btn primary" routerLink="/account">{{ 'notFound.back' | translate }}</a></section>`,
})
export class NotFoundPage {}
