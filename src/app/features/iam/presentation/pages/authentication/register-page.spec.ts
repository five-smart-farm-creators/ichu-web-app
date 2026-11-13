import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthFacade } from '../../../application/services/auth.facade';
import { RegisterPage } from './register-page';

// The page is rendered because template attributes such as min="1" add validators that the class alone does not show.
function renderPage(): RegisterPage {
  TestBed.configureTestingModule({
    imports: [RegisterPage],
    providers: [
      provideRouter([]),
      provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
      { provide: AuthFacade, useValue: { error: signal(null), registrationRetryable: signal(false), busy: signal(false) } },
    ],
  });
  const fixture = TestBed.createComponent(RegisterPage);
  fixture.detectChanges();
  return fixture.componentInstance;
}

function fillAccount(page: RegisterPage, role: 'rancher' | 'veterinarian'): void {
  page.form.patchValue({
    name: 'Eduardo Quispe',
    email: 'vet@example.test',
    password: 'secret-password',
    confirmPassword: 'secret-password',
    role,
    terms: true,
  });
}

describe('RegisterPage form', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lets a veterinarian continue after the ranch fields were shown and hidden', () => {
    const page = renderPage();
    fillAccount(page, 'veterinarian');

    expect(page.form.valid).toBe(true);
  });

  it('still requires the ranch details and a positive head count from a ranch manager', () => {
    const page = renderPage();
    fillAccount(page, 'rancher');
    expect(page.form.hasError('ranchDetailsRequired')).toBe(true);

    page.form.patchValue({ ranchName: 'Los Andes', region: 'Cusco', district: 'Urubamba', estimatedHeadCount: 40 });
    expect(page.form.valid).toBe(true);
  });
});
