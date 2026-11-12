import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { PlanningContextFacade } from '../../../../planning/application/acl/planning-context.facade';
import type { LivestockOperation } from '../../../domain/model/livestock-operation.model';
import { AlertRepository } from '../../../domain/repositories/alert.repository';
import { LivestockOperationRepository } from '../../../domain/repositories/livestock-operation.repository';
import { TelemetryRepository } from '../../../domain/repositories/telemetry.repository';
import { ClinicalHistoryPage } from './clinical-history-page';

const translations = {
  pages: { clinicalHistory: 'Clinical history' },
  health: {
    title: 'Clinical history',
    type: { Vaccination: 'Vaccination', HealthEvent: 'Health event' },
    kind: { clinical: 'Clinical intervention', field: 'Field event' },
    summary: {
      pendingAlerts: 'Pending alerts',
      withdrawalActive: 'In force until {{date}}',
      noWithdrawal: 'No withdrawal period',
    },
    timeline: { empty: 'No records in this period.' },
    records: { openField: 'Record health event', openClinical: 'Record clinical intervention' },
  },
  cattle: { stage: { Calf: 'Calf' }, status: { Active: 'Active' } },
  monitoring: { links: { openMonitoring: 'Open monitoring' } },
};

const OPERATION_ID = '9c2f7a1e-4b3d-4e8f-a6c5-7d1e2f3a4b5c';

function operation(operationId: string, type: LivestockOperation['type'], occurredAt: string): LivestockOperation {
  const clinical = type === 'Vaccination';
  return {
    operationId, cattleId: 'cattle-1', type, isClinical: clinical, occurredAt, receivedAt: occurredAt,
    observation: null, product: clinical ? 'Foot-and-mouth vaccine' : null, dose: clinical ? '2 ml' : null,
    sireReference: null, pregnancyResult: null, expectedCalvingDate: null,
  };
}

describe('ClinicalHistoryPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the timeline and summary of the selected animal, without identifiers', async () => {
    const context = {
      currentRanchId: signal('ranch-1'),
      currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope: 'ClinicalWrite' }),
      ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope: 'ClinicalWrite', expiresAt: null }]),
    };
    TestBed.configureTestingModule({
      imports: [ClinicalHistoryPage],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: IamContextFacade, useValue: context },
        {
          provide: LivestockOperationRepository,
          useValue: { list: vi.fn(async () => [operation(OPERATION_ID, 'Vaccination', '2026-11-10T10:00:00.000Z')]) },
        },
        {
          provide: TelemetryRepository,
          useValue: { latest: vi.fn(async () => { throw new Error('unavailable'); }) },
        },
        { provide: AlertRepository, useValue: { list: vi.fn(async () => ({ page: 1, pageSize: 1, totalCount: 2, items: [] })) } },
        {
          provide: PlanningContextFacade,
          useValue: { withdrawalPeriodsFor: vi.fn(async () => []) },
        },
        {
          provide: CattleInformationContextFacade,
          useValue: {
            monitoredCattle: vi.fn(async () => [{ cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' }]),
          },
        },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(ClinicalHistoryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.facade.selectAnimal('cattle-1');
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const text = element.textContent ?? '';
    expect(text).toContain('Vaccination');
    expect(text).toContain('Clinical intervention');
    expect(text).toContain('Foot-and-mouth vaccine');
    expect(text).toContain('Pending alerts');
    expect(text).toContain('No withdrawal period');
    expect(text).not.toContain(OPERATION_ID);
    expect(text).not.toContain('cattle-1');
  });
});
