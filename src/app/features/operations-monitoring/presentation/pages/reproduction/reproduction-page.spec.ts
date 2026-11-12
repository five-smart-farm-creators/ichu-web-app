import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import type { ReproductiveHistory } from '../../../domain/model/reproductive-history.model';
import { ReproductiveHistoryRepository } from '../../../domain/repositories/reproductive-history.repository';
import { ReproductionPage } from './reproduction-page';

const translations = {
  pages: { reproduction: 'Reproduction' },
  reproduction: {
    title: 'Reproduction',
    summary: { title: 'Figures' },
    kpi: {
      pregnancies: 'Confirmed pregnancies',
      services: 'Breeding services',
      servicesPerPregnancy: 'Services per pregnancy',
      lastCalving: 'Last calving',
      daysOpen: 'Current days open',
      expectedCalving: 'Expected calving',
      notPregnant: 'Not pregnant',
      note: 'Figures note',
    },
    intervals: {
      title: 'Calving intervals', calving: 'Calving', conception: 'Conception service', daysOpen: 'Days open', notYet: 'Not yet',
      empty: 'No calvings are recorded yet.',
    },
    timeline: { title: 'Events', empty: 'No events are recorded.' },
    event: { service: 'Breeding service', diagnosis: 'Pregnancy diagnosis', calving: 'Calving', abortion: 'Abortion', heat: 'Heat observed' },
    pregnancyResult: { Pregnant: 'Pregnant', Open: 'Open' },
    noHistoryTitle: 'No reproductive history',
    noHistory: 'This animal has no breeding services or calvings yet. It is {{months}} months old and is in the {{stage}} stage.',
    noAnimalTitle: 'No female selected',
    noAnimal: 'Choose a female to see her reproductive history.',
  },
  health: {
    type: { NaturalMating: 'Natural mating' },
    fields: { sireReference: 'Sire', expectedCalvingDate: 'Expected calving date' },
  },
  cattle: { stage: { Heifer: 'Heifer', MilkingCow: 'Milking cow' }, status: { Active: 'Active' } },
};

const history: ReproductiveHistory = {
  cattleId: 'cattle-1', sex: 'Female', lifeStage: 'MilkingCow', ageInMonths: 48, hasHistory: true,
  services: [{ occurredAt: '2026-03-01T08:00:00Z', method: 'NaturalMating', sireReference: 'Bull 7' }],
  pregnancyDiagnoses: [{ occurredAt: '2026-04-01T08:00:00Z', result: 'Pregnant', expectedCalvingDate: '2027-01-02' }],
  calvings: [{ occurredAt: '2025-12-01T08:00:00Z' }],
  abortions: [],
  heatsObserved: [],
  intervals: [{ calvingAt: '2025-12-01T08:00:00Z', conceptionServiceAt: '2026-03-01T08:00:00Z', daysOpen: 90 }],
  servicesPerPregnancy: 1,
  pregnanciesConfirmed: 1,
};

describe('ReproductionPage', () => {
  let histories: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    histories = { get: vi.fn(async () => history) };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function create() {
    const context = {
      currentRanchId: signal('ranch-1'),
      currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage' }),
      ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage', expiresAt: null }]),
    };
    TestBed.configureTestingModule({
      imports: [ReproductionPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: IamContextFacade, useValue: context },
        { provide: ReproductiveHistoryRepository, useValue: histories },
        {
          provide: CattleInformationContextFacade,
          useValue: {
            monitoredCattle: vi.fn(async () => [
              { cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'MilkingCow', sex: 'Female' },
              { cattleId: 'bull-1', earTag: '90', status: 'Active', lifeStage: 'FatteningBull', sex: 'Male' },
            ]),
          },
        },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(ReproductionPage);
    return fixture;
  }

  it('shows the figures and the dated events of a female, without identifiers', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.facade.selectAnimal('cattle-1');
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Confirmed pregnancies');
    expect(text).toContain('Natural mating');
    expect(text).toContain('Sire: Bull 7');
    expect(text).toContain('Pregnant');
    expect(text).not.toContain('cattle-1');
    expect(text).not.toContain('ranch-1');
  });

  it('explains an animal without history with its age in months and its stage', async () => {
    histories.get.mockResolvedValueOnce({
      ...history, lifeStage: 'Heifer', ageInMonths: 14, hasHistory: false, services: [], pregnancyDiagnoses: [], calvings: [],
      intervals: [], servicesPerPregnancy: null, pregnanciesConfirmed: 0,
    });
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.facade.selectAnimal('cattle-1');
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('No reproductive history');
    expect(text).toContain('It is 14 months old and is in the Heifer stage.');
  });

  it('lists the females only, so a male cannot be chosen for a reproductive record', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.facade.females().map(animal => animal.cattleId)).toEqual(['cattle-1']);
  });
});
