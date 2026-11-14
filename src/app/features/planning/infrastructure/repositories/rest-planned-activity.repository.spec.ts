import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { RestPlannedActivityRepository } from './rest-planned-activity.repository';

const ranchUrl = 'https://api.example.test/api/v1/ranches/ranch-1';
const activityUrl = 'https://api.example.test/api/v1/planned-activities/activity-1';

describe('RestPlannedActivityRepository', () => {
  let http: HttpTestingController;
  let repository: RestPlannedActivityRepository;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), RestPlannedActivityRepository,
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api/v1', firebase: null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(RestPlannedActivityRepository);
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it('reads the calendar with inclusive UTC instants', async () => {
    const from = new Date('2026-11-01T00:00:00Z');
    const to = new Date('2026-11-30T23:59:59.999Z');
    const result = repository.calendar('ranch-1', { from, to });
    const request = http.expectOne(req => req.url === ranchUrl + '/calendar');

    expect(request.request.params.get('from')).toBe('2026-11-01T00:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-30T23:59:59.999Z');
    request.flush([]);
    expect(await result).toEqual([]);
  });

  it('schedules an activity with its optional campaign and animal', async () => {
    const result = repository.schedule('ranch-1', {
      campaignId: null, cattleId: 'cattle-1', title: 'Check hooves', scheduledAt: '2026-11-12T08:00:00.000Z',
    });
    const request = http.expectOne(ranchUrl + '/planned-activities');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      campaignId: null, cattleId: 'cattle-1', title: 'Check hooves', scheduledAt: '2026-11-12T08:00:00.000Z',
    });
    request.flush({ id: 'activity-1' });
    await result;
  });

  it('reads one activity and its applications and follow-ups', async () => {
    const activity = repository.get('ranch-1', 'activity-1');
    http.expectOne(activityUrl).flush({ id: 'activity-1' });
    expect(await activity).toEqual({ id: 'activity-1' });

    const applications = repository.listApplications('ranch-1', 'activity-1');
    http.expectOne(activityUrl + '/applications').flush([]);
    expect(await applications).toEqual([]);

    const followUps = repository.listFollowUps('ranch-1', 'activity-1');
    http.expectOne(activityUrl + '/follow-ups').flush([]);
    expect(await followUps).toEqual([]);
  });

  it('records an application with the optional linked intervention', async () => {
    const result = repository.recordApplication('ranch-1', 'activity-1', {
      cattleId: 'cattle-1', appliedAt: '2026-11-11T09:00:00.000Z', interventionId: 'operation-9',
    });
    const request = http.expectOne(activityUrl + '/applications');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      cattleId: 'cattle-1', appliedAt: '2026-11-11T09:00:00.000Z', interventionId: 'operation-9',
    });
    request.flush({ id: 'application-1' });
    await result;
  });

  it('schedules a follow-up by its due instant', async () => {
    const result = repository.scheduleFollowUp('ranch-1', 'activity-1', { dueAt: '2026-11-20T08:00:00.000Z' });
    const request = http.expectOne(activityUrl + '/follow-ups');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ dueAt: '2026-11-20T08:00:00.000Z' });
    request.flush({ id: 'follow-up-1' });
    await result;
  });
});
