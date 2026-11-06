import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ichu-account-access-frame',
  imports: [RouterLink],
  templateUrl: './account-access-frame.html',
  styleUrls: ['./login-page.scss', './login-photo.scss', './login-responsive.scss', './account-access-frame.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountAccessFrame {
  readonly headingId = input.required<string>();
  readonly wide = input(false);
}
