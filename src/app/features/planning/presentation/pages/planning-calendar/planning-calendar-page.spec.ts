import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../../../shared/infrastructure/i18n/language.service';
import { IamContextFacade } from '../../../../iam/application/acl/iam-context.facade';
import { CattleInformationContextFacade } from '../../../../cattle-information/application/acl/cattle-information-context.facade';
import type { PlannedActivity } from '../../../domain/model/planned-activity.model';
import { PlannedActivityRepository } from '../../../domain/repositories/planned-activity.repository';
import { PlanningCalendarPage } from './planning-calendar-page';

const translations = {
  planning: {
    calendar: { title: 'Calendar', viewGrid: 'Month grid', viewAgenda: 'Agenda', ranchWide: 'Whole ranch', pickDay: 'Select a day' },
    reminders: { upcoming: 'Upcoming 7 days', overdue: 'Overdue', noUpcoming: 'Nothing upcoming', noOverdue: 'Nothing overdue' },
    state: { Scheduled: 'Scheduled', Overdue: 'Overdue', overdueOne: 'Overdue by 1 day', overdueDays: 'Overdue by {{count}} days' },
  },
  common: { cancel: 'Cancel' },
};

const ACTIVITY_ID = '3b8d0c6e-1f1a-4c7a-9a55-2f0f7d2d9a11';

function activity(id: string, title: string, scheduledAt: Date): PlannedActivity {
  return { id, campaignId: null, cattleId: null, title, scheduledAt: scheduledAt.toISOString() };
}

describe('PlanningCalendarPage', () => {
  let activities: { calendar: ReturnType<typeof vi.fn>; listApplications: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const now = Date.now();
    const upcoming = activity(ACTIVITY_ID, 'Vaccinate herd', new Date(now + 2 * 86_400_000));
    const overdue = activity('0f9e8d7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c', 'Deworm calves', new Date(now - 3 * 86_400_000));
    activities = {
      calendar: vi.fn(async () => [overdue, upcoming]),
      listApplications: vi.fn(async () => []),
    };
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function render() {
    const context = {
      currentRanchId: signal('ranch-1'),
      currentRanch: signal({ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage' }),
      ranches: signal([{ ranchId: 'ranch-1', name: 'North Pasture', scope: 'Manage', expiresAt: null }]),
    };
    TestBed.configureTestingModule({
      imports: [PlanningCalendarPage],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(translations) } },
          fallbackLang: 'en',
          lang: 'en',
        }),
        LanguageService,
        { provide: IamContextFacade, useValue: context },
        { provide: PlannedActivityRepository, useValue: activities },
        { provide: CattleInformationContextFacade, useValue: { monitoredCattle: vi.fn(async () => []) } },
      ],
    });
    TestBed.inject(TranslateService).use('en').subscribe();
    const fixture = TestBed.createComponent(PlanningCalendarPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    return fixture;
  }

  it('shows the month grid, the overdue and upcoming reminders, and no activity identifier', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;
    const text = element.textContent ?? '';

    expect(element.querySelectorAll('.calendar-grid .day')).toHaveLength(42);
    expect(text).toContain('Upcoming 7 days');
    expect(text).toContain('Vaccinate herd');
    expect(text).toContain('Overdue by 3 days');
    expect(text).toContain('Deworm calves');
    expect(text).not.toContain(ACTIVITY_ID);
  });
});
