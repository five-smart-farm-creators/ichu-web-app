import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import type { Device } from '../../../domain/model/device.model';
import { DeviceRepository } from '../../../domain/repositories/device.repository';
import { WaterTroughRepository } from '../../../domain/repositories/water-trough.repository';
import { DevicesPage } from './devices-page';

const translations = {
  pages: { iotDevices: 'IoT devices' },
  devices: {
    inventory: { title: 'IoT devices', register: 'Register device', loading: 'Loading devices' },
    fields: { serial: 'Serial number', assignedTo: 'Assigned to' },
    type: { SmartCollar: 'Smart collar', WaterController: 'Water controller' },
    status: { Available: 'Available', InService: 'In service', Maintenance: 'Maintenance' },
    communication: { NeverReported: 'Never reported', Communicating: 'Communicating', NoCommunication: 'No communication' },
    actions: {
      assign: 'Assign', release: 'Release', history: 'History',
      maintenanceOn: 'Put in maintenance', maintenanceOff: 'End maintenance',
    },
  },
};

function device(serial: string, overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-' + serial, ranchId: 'ranch-1', serial, type: 'SmartCollar', status: 'Available', isAvailable: true,
    communicationStatus: 'NeverReported', lastCommunicationAt: null, lastCommunicationReceivedAt: null,
    batteryPercentage: null, batteryRecordedAt: null, isBatteryLow: null, firmwareVersion: null, version: 'v1',
    currentAssignment: null, ...overrides,
  };
}

/** The inventory loads over several promise hops, so wait for a full turn of the event loop before reading the DOM. */
async function settle(fixture: ComponentFixture<DevicesPage>): Promise<void> {
  await fixture.whenStable();
  await new Promise(resolve => setTimeout(resolve));
  fixture.detectChanges();
}

function buttonLabels(fixture: ComponentFixture<DevicesPage>): string[] {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.map(button => (button.textContent ?? '').trim());
}

describe('DevicesPage', () => {
  let scope: 'Manage' | 'Read';

  function render(): ComponentFixture<DevicesPage> {
    const deviceRepository = {
      list: vi.fn(async () => [
        device('SN-100'),
        device('SN-200', { type: 'WaterController', status: 'Maintenance', batteryPercentage: 12, isBatteryLow: true }),
      ]),
      register: vi.fn(),
      setMaintenance: vi.fn(),
      assign: vi.fn(),
      release: vi.fn(),
      assignments: vi.fn(),
    };
    const context = {
      currentRanchId: signal('ranch-1'),
      currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope }),
      ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope, expiresAt: null }]),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DevicesPage],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: IamContextFacade, useValue: context },
        { provide: DeviceRepository, useValue: deviceRepository },
        { provide: WaterTroughRepository, useValue: { list: vi.fn(async () => []), register: vi.fn(), configureTemperatureRange: vi.fn() } },
        { provide: CattleInformationContextFacade, useValue: { cattleSummaries: vi.fn(async () => []) } },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(DevicesPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    scope = 'Manage';
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists the serial numbers and offers registration and assignment to a managing account', async () => {
    const fixture = render();
    await settle(fixture);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('SN-100');
    expect(text).toContain('SN-200');
    expect(buttonLabels(fixture)).toContain('Register device');
    expect(buttonLabels(fixture)).toContain('Assign');
  });

  it('hides registration, assignment, and maintenance from an account that only reads the ranch', async () => {
    scope = 'Read';
    const fixture = render();
    await settle(fixture);

    expect(buttonLabels(fixture)).not.toContain('Register device');
    expect(buttonLabels(fixture)).not.toContain('Assign');
    expect(buttonLabels(fixture)).toContain('History');
  });
});
