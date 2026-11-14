import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import { MonitoringThresholdsFacade } from '../../application/services/monitoring-thresholds.facade';
import type { MonitoringThreshold } from '../../domain/model/monitoring-threshold.model';
import { ThresholdDialog } from './threshold-dialog';

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as Record<string, unknown>;

const warning: MonitoringThreshold = {
  thresholdId: 'threshold-1', lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38, maxValue: 39.5, severity: 'Warning', revision: 1,
};

/** Collapses whitespace so assertions do not depend on how the template is laid out. */
function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('ThresholdDialog', () => {
  let facade: { thresholds: () => readonly MonitoringThreshold[]; configure: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  function create(existing: MonitoringThreshold | null) {
    TestBed.configureTestingModule({
      imports: [ThresholdDialog],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        { provide: MonitoringThresholdsFacade, useValue: facade },
        { provide: MAT_DIALOG_DATA, useValue: existing },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(ThresholdDialog);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    facade = { thresholds: () => [warning], configure: vi.fn(async () => warning) };
    dialogRef = { close: vi.fn() };
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('offers only the Warning and Critical levels', () => {
    expect(create(null).componentInstance.severities).toEqual(['Warning', 'Critical']);
  });

  it('keeps the stage, metric and severity of an edited threshold fixed', () => {
    const { form } = create(warning).componentInstance;

    expect(form.controls.lifeStage.disabled).toBe(true);
    expect(form.controls.metric.disabled).toBe(true);
    expect(form.controls.severity.disabled).toBe(true);
    expect(form.controls.minValue.enabled).toBe(true);
  });

  it('refuses a Critical range that does not contain the Warning range without asking the API', async () => {
    const fixture = create(null);
    const dialog = fixture.componentInstance;
    dialog.form.setValue({ lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 38.5, maxValue: 39, severity: 'Critical' });

    await dialog.save();
    fixture.detectChanges();

    expect(dialog.levelsError()).toBe(true);
    expect(facade.configure).not.toHaveBeenCalled();
    expect(textOf(fixture.nativeElement)).toContain('The Critical range must contain the Warning range.');
  });

  it('saves a Critical range that contains the Warning range', async () => {
    const dialog = create(null).componentInstance;
    dialog.form.setValue({ lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37, maxValue: 40, severity: 'Critical' });

    await dialog.save();

    expect(facade.configure).toHaveBeenCalledWith({
      lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37, maxValue: 40, severity: 'Critical',
    });
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('shows the API level clash with the same sentence as the local check', async () => {
    facade.configure.mockRejectedValueOnce(new ApiError(400, 'OperationsMonitoring.ThresholdLevelsInconsistent', 'Server title.'));
    const fixture = create(null);
    const dialog = fixture.componentInstance;
    dialog.form.setValue({ lifeStage: 'Calf', metric: 'BodyTemperature', minValue: 37, maxValue: 40, severity: 'Critical' });

    await dialog.save();
    fixture.detectChanges();

    expect(textOf(fixture.nativeElement)).toContain('The Critical range must contain the Warning range.');
    expect(textOf(fixture.nativeElement)).not.toContain('Server title.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
