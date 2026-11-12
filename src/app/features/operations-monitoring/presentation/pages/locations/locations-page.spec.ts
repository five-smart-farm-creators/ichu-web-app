import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RUNTIME_CONFIG } from '../../../../../core/config/runtime-config';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import type { Geofence } from '../../../domain/model/geofence.model';
import type { LatestTelemetry } from '../../../domain/model/telemetry.model';
import { GeofenceRepository } from '../../../domain/repositories/geofence.repository';
import { TelemetryRepository } from '../../../domain/repositories/telemetry.repository';
import { LocationsPage } from './locations-page';

// The real English copy is used so the notice is checked as the user reads it.
const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as {
  monitoring: { map: { unavailable: string } };
};

const paddock: Geofence = {
  geofenceId: 'geofence-1',
  lotId: 'lot-1',
  name: 'North paddock',
  toleranceMeters: 15,
  severity: 'Warning',
  revision: 1,
  vertices: [
    { latitude: -12.1, longitude: -77.1 },
    { latitude: -12.2, longitude: -77.1 },
    { latitude: -12.2, longitude: -77.0 },
  ],
};

function latest(): LatestTelemetry {
  const unavailable = { status: 'Unavailable' as const, value: null, unit: 'celsius', recordedAt: null, isStale: null };
  return {
    cattleId: 'cattle-1',
    evaluatedAt: '2026-11-11T12:00:00Z',
    lastReadingRecordedAt: '2026-11-11T11:55:00Z',
    bodyTemperature: unavailable,
    activityIndex: { ...unavailable, unit: 'index' },
    ruminationMinutes: { ...unavailable, unit: 'minutes' },
    lastKnownPosition: {
      status: 'Available', latitude: -12.15, longitude: -77.05, accuracyMeters: 4, recordedAt: '2026-11-11T11:55:00Z', isStale: false,
    },
  };
}

/** Lets the page's pending loads and the map availability check finish, then re-renders the settled view. */
async function settle(fixture: { detectChanges: () => void }): Promise<void> {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();
  }
}

/** Renders the page with no Maps key, so the script is never requested and only the notice and tables can appear. */
function render() {
  const context = {
    currentRanchId: signal('ranch-1'),
    currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage' }),
    ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage', expiresAt: null }]),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LocationsPage],
    providers: [
      provideRouter([]),
      provideTranslateService({
        loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
        fallbackLang: 'en',
        lang: 'en',
      }),
      LanguageService,
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null, googleMaps: null } },
      { provide: IamContextFacade, useValue: context },
      { provide: TelemetryRepository, useValue: { latest: vi.fn(async () => latest()), readings: vi.fn() } },
      {
        provide: GeofenceRepository,
        useValue: { list: vi.fn(async () => [paddock]), define: vi.fn(), redefine: vi.fn() },
      },
      {
        provide: CattleInformationContextFacade,
        useValue: {
          lotSummaries: vi.fn(async () => [{ lotId: 'lot-1', name: 'Heifers' }]),
          monitoredCattle: vi.fn(async () => [{ cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf' }]),
        },
      },
    ],
  });
  TestBed.inject(TranslateService).use('en').subscribe();
  const fixture = TestBed.createComponent(LocationsPage);
  fixture.detectChanges();
  return fixture;
}

describe('LocationsPage without a Maps key', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('keeps the grazing zone and position tables and explains that the map is not available', async () => {
    const fixture = render();
    await settle(fixture);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('North paddock');
    expect(text).toContain('Heifers');
    expect(text).toContain('101');
    expect(text).toContain(translations.monitoring.map.unavailable);
    expect(fixture.nativeElement.querySelector('ichu-monitoring-map')).toBeNull();
  });
});
