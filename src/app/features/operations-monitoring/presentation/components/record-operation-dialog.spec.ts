import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { LivestockOperationRecorder } from '../../application/services/livestock-operation-recorder';
import { LivestockOperationRepository } from '../../domain/repositories/livestock-operation.repository';
import { RecordOperationDialog, type RecordOperationData } from './record-operation-dialog';

const copy = { titleKey: 'health.records.fieldTitle', leadKey: 'health.records.fieldLead', submitKey: 'health.records.fieldSubmit' };
const animal = { cattleId: 'cattle-1', earTag: '101', status: 'Active' as const, lifeStage: 'MilkingCow', sex: 'Female' as const };

// The day of the diagnosis is fixed, so the calving window is checked against a known date.
const now = new Date(2026, 10, 12, 18);

describe('RecordOperationDialog', () => {
  let records: { registerFieldEvent: ReturnType<typeof vi.fn>; registerClinicalIntervention: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function create(types: RecordOperationData['types']) {
    TestBed.configureTestingModule({
      imports: [RecordOperationDialog],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of({}) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        LivestockOperationRecorder,
        { provide: LivestockOperationRepository, useValue: records },
        { provide: MAT_DIALOG_DATA, useValue: { ranchId: 'ranch-1', animal, types, copy } satisfies RecordOperationData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    return TestBed.createComponent(RecordOperationDialog).componentInstance;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    records = {
      registerFieldEvent: vi.fn(async () => ({})),
      registerClinicalIntervention: vi.fn(async () => ({})),
    };
    dialogRef = { close: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('sends a pregnant diagnosis with its calving date as a calendar day', async () => {
    const dialog = create(['PregnancyDiagnosis']);
    dialog.form.controls.time.setValue('09:00');
    dialog.form.controls.pregnancyResult.setValue('Pregnant');
    dialog.form.controls.expectedCalvingDate.setValue(new Date(2027, 7, 1));

    await dialog.save();

    expect(records.registerClinicalIntervention).toHaveBeenCalledWith('ranch-1', expect.objectContaining({
      cattleId: 'cattle-1', type: 'PregnancyDiagnosis', pregnancyResult: 'Pregnant', expectedCalvingDate: '2027-08-01',
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }));
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('refuses a calving date more than 300 days after the diagnosis day without asking the API', async () => {
    const dialog = create(['PregnancyDiagnosis']);
    dialog.form.controls.time.setValue('09:00');
    dialog.form.controls.pregnancyResult.setValue('Pregnant');
    dialog.form.controls.expectedCalvingDate.setValue(new Date(2027, 8, 10));

    await dialog.save();

    expect(dialog.calvingError()).toBe('reproduction.validation.calvingTooFar');
    expect(records.registerClinicalIntervention).not.toHaveBeenCalled();
  });

  it('names the sire only for a breeding service, and never on an event', async () => {
    const service = create(['NaturalMating', 'Insemination']);
    service.form.controls.time.setValue('09:00');
    service.form.controls.sireReference.setValue(' Bull 7 ');

    await service.save();

    expect(records.registerFieldEvent).toHaveBeenCalledWith('ranch-1', expect.objectContaining({ type: 'NaturalMating', sireReference: 'Bull 7' }));
  });

  it('keeps a field event free of reproductive facts', async () => {
    const event = create(['HealthEvent']);
    event.form.controls.time.setValue('09:00');

    await event.save();

    const request = records.registerFieldEvent.mock.calls[0][1];
    expect(request).not.toHaveProperty('sireReference');
    expect(request).not.toHaveProperty('pregnancyResult');
    expect(request).not.toHaveProperty('expectedCalvingDate');
  });
});
