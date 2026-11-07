import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ichu-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="empty-state"><span class="eyebrow">404</span><h1>Page not found</h1>
    <p>Check the address or return to your ICHU account.</p>
    <a class="btn primary" routerLink="/account">Back to account</a></main>`,
})
export class NotFoundPage {}
