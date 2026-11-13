import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import type { Cattle } from '../../../domain/model/cattle.model';
import { CattleRepository } from '../../../domain/repositories/cattle.repository';
import { LotRepository } from '../../../domain/repositories/lot.repository';
import { CattleProfilePage } from './cattle-profile-page';

const translations = {
  pages: { animalProfile: 'Animal profile' },
  cattle: {
    profile: { edit: 'Edit data', noCollar: 'No collar assigned', history: 'Stage history', back: 'Back to animals' },
    status: { Active: 'Active', Inactive: 'Inactive' },
    stage: { Calf: 'Calf' },
  },
};

function animal(): Cattle {
  return {
    id: 'cattle-1', ranchId: 'ranch-1', earTag: '101', breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10',
    currentStage: 'Calf', status: 'Active', exitReason: null, exitDate: null, version: 'v1',
    stagePeriods: [{ id: 'period-1', lifeStage: 'Calf', validFrom: '2025-01-10', validTo: null }],
  };
}

describe('CattleProfilePage', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the animal, its collar status and the edit action to a manager', async () => {
    const cattleRepository = {
      list: vi.fn(),
      register: vi.fn(),
      profile: vi.fn(async () => ({ cattle: animal(), device: { isAvailable: true, collarId: null, lastReadingReceivedAt: null } })),
      update: vi.fn(),
      changeLifeStage: vi.fn(),
      recordExit: vi.fn(),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'cattle/:cattleId', component: CattleProfilePage }]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        {
          provide: IamContextFacade,
          useValue: {
            currentRanchId: signal('ranch-1'),
            currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage' }),
            ranches: signal([]),
          },
        },
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: { list: vi.fn(async () => []), create: vi.fn(), assignCattle: vi.fn(), removeCattle: vi.fn() } },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/cattle/cattle-1', CattleProfilePage);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    const text: string = harness.fixture.nativeElement.textContent;
    expect(cattleRepository.profile).toHaveBeenCalledWith('ranch-1', 'cattle-1');
    expect(text).toContain('101');
    expect(text).toContain('No collar assigned');
    expect(text).toContain('Edit data');
  });
});
