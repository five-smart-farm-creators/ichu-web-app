import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import type { Cattle } from '../../../domain/model/cattle.model';
import { CattleRepository } from '../../../domain/repositories/cattle.repository';
import { LotRepository } from '../../../domain/repositories/lot.repository';
import { CattleInventoryPage } from './cattle-inventory-page';

const translations = {
  pages: { animals: 'Animals' },
  cattle: {
    inventory: { title: 'Animals', register: 'Register animal', loading: 'Loading animals' },
    fields: { earTag: 'Ear tag' },
    status: { Active: 'Active', Inactive: 'Inactive' },
  },
};

function animal(earTag: string): Cattle {
  return {
    id: 'cattle-' + earTag, ranchId: 'ranch-1', earTag, breed: 'Criollo', sex: 'Female', birthDate: '2025-01-10',
    currentStage: 'Calf', status: 'Active', exitReason: null, exitDate: null, version: 'v1', stagePeriods: [],
  };
}

describe('CattleInventoryPage', () => {
  let scope: 'Manage' | 'Read';

  function render() {
    const cattleRepository = {
      list: vi.fn(async () => [animal('101'), animal('102')]),
      register: vi.fn(),
      profile: vi.fn(),
      update: vi.fn(),
      changeLifeStage: vi.fn(),
      recordExit: vi.fn(),
    };
    const lotRepository = { list: vi.fn(async () => []), create: vi.fn(), assignCattle: vi.fn(), removeCattle: vi.fn() };
    const context = {
      currentRanchId: signal('ranch-1'),
      currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope }),
      ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope, expiresAt: null }]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CattleInventoryPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: IamContextFacade, useValue: context },
        { provide: CattleRepository, useValue: cattleRepository },
        { provide: LotRepository, useValue: lotRepository },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(CattleInventoryPage);
    fixture.detectChanges();
    return { fixture, cattleRepository };
  }

  beforeEach(() => {
    scope = 'Manage';
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the animals of the ranch and offers registration to a manager', async () => {
    const { fixture, cattleRepository } = render();
    await fixture.whenStable();
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(cattleRepository.list).toHaveBeenCalled();
    expect(text).toContain('101');
    expect(text).toContain('102');
    expect(text).toContain('Register animal');
  });

  it('hides registration from an account that only reads the ranch', async () => {
    scope = 'Read';
    const { fixture } = render();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Register animal');
  });
});
