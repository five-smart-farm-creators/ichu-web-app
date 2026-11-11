import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'ichu-terms-page', standalone: true, imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="terms">
    <a class="btn secondary" routerLink="/account">{{ 'terms.back' | translate }}</a>
    <h1>{{ 'pages.terms' | translate }}</h1>
    <section>
      <h2>{{ 'terms.authenticationTitle' | translate }}</h2>
      <p>{{ 'terms.authentication' | translate }}</p>
    </section>
    <section>
      <h2>{{ 'terms.recordsTitle' | translate }}</h2>
      <p>{{ 'terms.records' | translate }}</p>
    </section>
    <section>
      <h2>{{ 'terms.preferencesTitle' | translate }}</h2>
      <p>{{ 'terms.preferences' | translate }}</p>
    </section>
    <section>
      <h2>{{ 'terms.paymentsTitle' | translate }}</h2>
      <p>{{ 'terms.payments' | translate }}</p>
    </section>
    <section>
      <h2>{{ 'terms.contactTitle' | translate }}</h2>
      <p>{{ 'terms.contact' | translate }}</p>
    </section>
  </article>`,
  styles: '.terms{max-width:760px;margin:48px auto;padding:24px;display:grid;gap:24px}.terms p{color:var(--muted);line-height:1.8}',
})
export class TermsPage {}
