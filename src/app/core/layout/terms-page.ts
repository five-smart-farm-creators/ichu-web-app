import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ichu-terms-page', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="terms">
    <a class="btn secondary" routerLink="/account">Back to account</a>
    <h1>Terms and privacy</h1>
    <p>ICHU by SmartFarm.</p>
    <h2>Authentication and account data</h2>
    <p>Sign-in uses Firebase Authentication. Account and ranch access are verified by the ICHU API. Passwords are sent only to the configured authentication services and are never stored by application code.</p>
    <h2>Workspace records</h2>
    <p>Modules that still use local fixture repositories reset their records when the page is reloaded. These records do not represent live farm telemetry, payments or clinical decisions.</p>
    <h2>Browser preferences</h2>
    <p>The selected language is saved in this browser. Firebase manages authentication persistence according to the configured session settings.</p>
  </article>`,
  styles: '.terms{max-width:760px;margin:48px auto;padding:24px;display:grid;gap:24px}.terms p{color:var(--muted);line-height:1.8}',
})
export class TermsPage {}
