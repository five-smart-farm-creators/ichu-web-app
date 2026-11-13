import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerLocaleData } from '@angular/common';
import localeEs419 from '@angular/common/locales/es-419';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../application/acl/iam-context.facade';
import { AuthFacade } from '../../../application/services/auth.facade';
import type { AuthUser, IamAccount, RanchAccess } from '../../../domain/model/auth.model';
import { AuthenticationRepository } from '../../../domain/repositories/authentication.repository';
import { ProfessionalProfileRepository } from '../../../domain/repositories/professional-profile.repository';
import { AccountPage } from './account-page';

const ranchId = 'a1f0c3e2-1111-4a2b-9c3d-000000000001';

function translations(language: string): object {
  // The test run starts in the project root, where public/ holds the translation files served to the app.
  return JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', `${language}.json`), 'utf8')) as object;
}

describe('AccountPage', () => {
  let fixture: ComponentFixture<AccountPage>;
  let language: LanguageService;
  let authentication: { changePassword: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    registerLocaleData(localeEs419);
  });

  beforeEach(async () => {
    localStorage.clear();
    authentication = { changePassword: vi.fn(async () => undefined) };
    const auth = {
      account: signal<IamAccount | null>({
        id: 'account-1',
        email: 'vet@example.test',
        role: 'Veterinarian',
        status: 'Active',
        profile: { specialty: 'Bovine medicine', licenseNumber: 'CMVP-1234', yearsOfExperience: 8 },
      }),
      currentUser: signal<AuthUser | null>({ uid: 'user-1', email: 'vet@example.test', displayName: null, emailVerified: true }),
      name: signal('vet@example.test'),
      ranchAccess: signal<readonly RanchAccess[]>([{
        ranchId,
        scope: 'Manage',
        expiresAt: new Date(2027, 0, 31, 12).toISOString(),
        name: 'Lakeside',
        region: 'Puno',
        district: 'Melgar',
        accessCode: 'ABCD2345',
      }]),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: (lang: string) => of(translations(lang)) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        IamContextFacade,
        { provide: AuthFacade, useValue: auth },
        { provide: AuthenticationRepository, useValue: authentication },
        { provide: ProfessionalProfileRepository, useValue: { current: vi.fn(), complete: vi.fn() } },
      ],
    }).compileComponents();
    language = TestBed.inject(LanguageService);
    await language.initialize();
    fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('switches the copy and dates with the selected language and shows no ranch identifier', async () => {
    const text = (): string => fixture.nativeElement.textContent as string;

    expect(text()).toContain('My account');
    expect(text()).toContain('Expires Jan 31, 2027');
    expect(text()).toContain('Specialty');
    expect(text()).toContain('ABCD2345');
    expect(text()).not.toContain(ranchId);

    await language.use('es');
    fixture.detectChanges();

    expect(text()).toContain('Mi cuenta');
    expect(text()).toContain('Vence el 31 ene 2027');
    expect(text()).toContain('Especialidad');
    expect(text()).not.toContain('My account');
    expect(text()).not.toContain('Expires');
  });

  it('clears the password fields as soon as the change is submitted', async () => {
    const page = fixture.componentInstance;
    page.passwordForm.setValue({ currentPassword: 'current-example', newPassword: 'next-example-1', confirmPassword: 'next-example-1' });

    await page.changePassword();

    expect(authentication.changePassword).toHaveBeenCalledWith('current-example', 'next-example-1');
    expect(page.passwordForm.getRawValue()).toEqual({ currentPassword: '', newPassword: '', confirmPassword: '' });
  });
});
