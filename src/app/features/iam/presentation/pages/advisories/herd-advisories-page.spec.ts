import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerLocaleData } from '@angular/common';
import localeEs419 from '@angular/common/locales/es-419';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../application/acl/iam-context.facade';
import { AuthFacade } from '../../../application/services/auth.facade';
import type { AuthUser, IamAccount, RanchAccess } from '../../../domain/model/auth.model';
import type { HerdAdvisoryRecord } from '../../../domain/model/herd-advisory.model';
import type { ProfessionalProfile } from '../../../domain/model/professional-profile.model';
import { HerdAdvisoryRepository } from '../../../domain/repositories/herd-advisory.repository';
import { RanchDirectoryRepository } from '../../../domain/repositories/ranch-directory.repository';
import { HerdAdvisoriesPage } from './herd-advisories-page';

const ranchId = 'a1f0c3e2-1111-4a2b-9c3d-000000000001';
const profile: ProfessionalProfile = { specialty: 'Bovine medicine', licenseNumber: 'CMVP-1234', yearsOfExperience: 8 };

const pendingAdvisory: HerdAdvisoryRecord = {
  id: 'advisory-1',
  veterinarianId: 'veterinarian-1',
  ranchId,
  reason: 'Vaccine review for the herd',
  status: 'Pending',
  scope: 'Read',
  requestedAt: '2026-11-01T10:00:00Z',
  grantedAt: null,
  expiresAt: null,
  endedAt: null,
  veterinarianProfile: profile,
};

function translations(language: string): object {
  // The test run starts in the project root, where public/ holds the translation files served to the app.
  return JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', `${language}.json`), 'utf8')) as object;
}

async function settleAsyncWork(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe('HerdAdvisoriesPage', () => {
  let fixture: ComponentFixture<HerdAdvisoriesPage>;
  let language: LanguageService;
  const text = (): string => fixture.nativeElement.textContent as string;

  beforeAll(() => {
    registerLocaleData(localeEs419);
  });

  async function render(role: string, professional: ProfessionalProfile | null, ranches: readonly RanchAccess[]): Promise<void> {
    const auth = {
      account: signal<IamAccount | null>({
        id: 'account-1', email: 'user@example.test', role, status: 'Active', profile: professional,
      }),
      currentUser: signal<AuthUser | null>({ uid: 'user-1', email: 'user@example.test', displayName: null, emailVerified: true }),
      name: signal('user@example.test'),
      ranchAccess: signal(ranches),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HerdAdvisoriesPage],
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
        { provide: HerdAdvisoryRepository, useValue: { list: vi.fn(async () => [pendingAdvisory]), request: vi.fn(), decide: vi.fn() } },
        { provide: RanchDirectoryRepository, useValue: { findByAccessCode: vi.fn(async () => null) } },
      ],
    }).compileComponents();
    language = TestBed.inject(LanguageService);
    await language.initialize();
    fixture = TestBed.createComponent(HerdAdvisoriesPage);
    TestBed.flushEffects();
    await settleAsyncWork();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('lists the managed ranch requests with translated status and no internal identifiers', async () => {
    await render('RanchManager', null, [{
      ranchId, scope: 'Manage', expiresAt: null, name: 'Lakeside', region: null, district: null, accessCode: 'ABCD2345',
    }]);

    expect(text()).toContain('Access requests');
    expect(text()).toContain('Vaccine review for the herd');
    expect(text()).toContain('Pending');
    expect(text()).toContain('Nov 1, 2026');
    expect(text()).not.toContain(ranchId);
    expect(text()).not.toContain('advisory-1');

    await language.use('es');
    fixture.detectChanges();

    expect(text()).toContain('Solicitudes de acceso');
    expect(text()).toContain('Pendiente');
    expect(text()).toContain('1 nov 2026');
    expect(text()).not.toContain('Access requests');
  });

  it('opens the decision dialog in the selected language', async () => {
    await render('RanchManager', null, [{
      ranchId, scope: 'Manage', expiresAt: null, name: 'Lakeside', region: null, district: null, accessCode: 'ABCD2345',
    }]);

    void fixture.componentInstance.review(pendingAdvisory);
    TestBed.inject(ApplicationRef).tick();
    expect(document.body.textContent).toContain('Review access request');
    expect(document.body.textContent).toContain('Grant access');

    await language.use('es');
    TestBed.inject(ApplicationRef).tick();
    expect(document.body.textContent).toContain('Revisar solicitud de acceso');
    expect(document.body.textContent).toContain('Conceder acceso');
  });

  it('shows a veterinarian the profile requirement and the ranch access they already hold', async () => {
    await render('Veterinarian', null, [{
      ranchId, scope: 'Read', expiresAt: null, name: 'Lakeside', region: 'Puno', district: 'Melgar', accessCode: null,
    }]);

    expect(text()).toContain('Request ranch access');
    expect(text()).toContain('Complete your professional profile before requesting access.');
    expect(text()).toContain('Lakeside');
    expect(text()).not.toContain(ranchId);

    await language.use('es');
    fixture.detectChanges();

    expect(text()).toContain('Solicitar acceso a una unidad productiva');
    expect(text()).toContain('Buscar unidad productiva');
  });
});
