import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { MonitoredCattleSummary } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { Alert, AlertPage } from '../../domain/model/alert.model';
import { AlertRepository } from '../../domain/repositories/alert.repository';
import { ALERT_PAGE_SIZE, AlertsFacade } from './alerts.facade';

function alert(id: string, version = 1): Alert {
  return {
    alertId: id, cattleId: 'cattle-1', type: 'Temperature', severity: 'Warning', status: 'Pending', raisedAt: '2026-11-11T10:00:00Z',
    detectedValue: 40.2, unit: 'celsius', thresholdMinValue: 38, thresholdMaxValue: 39.5, geofenceId: null, latitude: null,
    longitude: null, distanceToBoundaryMeters: null, exitDurationSeconds: null, acknowledgedAt: null, finding: null, action: null,
    responseTimeSeconds: null, version,
  };
}

function pageOf(items: Alert[], totalCount = items.length): AlertPage {
  return { page: 1, pageSize: ALERT_PAGE_SIZE, totalCount, items };
}

const animals: MonitoredCattleSummary[] = [{ cattleId: 'cattle-1', earTag: '101', status: 'Active', lifeStage: 'Calf', sex: 'Female' }];

describe('AlertsFacade', () => {
  let facade: AlertsFacade;
  let alerts: { list: ReturnType<typeof vi.fn>; acknowledge: ReturnType<typeof vi.fn> };
  let cattleContext: { monitoredCattle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    alerts = { list: vi.fn(async () => pageOf([alert('alert-1')], 1)), acknowledge: vi.fn(async () => alert('alert-1', 2)) };
    cattleContext = { monitoredCattle: vi.fn(async () => animals) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AlertsFacade,
        { provide: AlertRepository, useValue: alerts },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(AlertsFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens the first page without filters and names the animals of the alerts', async () => {
    await facade.open('ranch-1');

    expect(alerts.list).toHaveBeenCalledWith('ranch-1', { status: null, cattleId: null }, 1, ALERT_PAGE_SIZE);
    expect(cattleContext.monitoredCattle).toHaveBeenCalledWith('ranch-1', { activeOnly: false }, Number.POSITIVE_INFINITY);
    expect(facade.rows()).toHaveLength(1);
    expect(facade.totalCount()).toBe(1);
    expect(facade.earTag('cattle-1')).toBe('101');
    expect(facade.earTag('cattle-unknown')).toBe('');
  });

  it('applies a status and animal filter from the first page', async () => {
    await facade.open('ranch-1');
    await facade.goToPage(2, ALERT_PAGE_SIZE);
    await facade.search({ status: 'Pending', cattleId: 'cattle-1' });

    expect(alerts.list).toHaveBeenLastCalledWith('ranch-1', { status: 'Pending', cattleId: 'cattle-1' }, 1, ALERT_PAGE_SIZE);
    expect(facade.pageIndex()).toBe(0);
  });

  it('acknowledges with the version it read and a new operation ID for every attempt', async () => {
    await facade.open('ranch-1');

    await facade.acknowledge(alert('alert-1', 1), { finding: 'Checked the animal', action: null });
    await facade.acknowledge(alert('alert-1', 1), { finding: 'Checked again', action: 'Moved' });

    const first = alerts.acknowledge.mock.calls[0];
    const second = alerts.acknowledge.mock.calls[1];
    expect(first[0]).toBe('ranch-1');
    expect(first[1]).toBe('alert-1');
    expect(first[2]).toMatchObject({ finding: 'Checked the animal', action: null, expectedVersion: 1 });
    expect(first[2].operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second[2].operationId).not.toBe(first[2].operationId);
    expect(alerts.list.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('reloads the queue and reports the version conflict when the alert changed meanwhile', async () => {
    await facade.open('ranch-1');
    alerts.acknowledge.mockRejectedValueOnce(new ApiError(409, 'version-conflict', null));
    const callsBefore = alerts.list.mock.calls.length;

    await expect(facade.acknowledge(alert('alert-1', 1), { finding: 'Checked', action: null }))
      .rejects.toMatchObject({ code: 'version-conflict' });
    expect(alerts.list.mock.calls.length).toBe(callsBefore + 1);
  });

  it('moves back to the last existing page when the filtered list shrinks', async () => {
    await facade.open('ranch-1');
    const oneFullPage = Array.from({ length: ALERT_PAGE_SIZE }, (_, index) => alert(`a-${index}`));
    alerts.list.mockResolvedValue(pageOf(oneFullPage, ALERT_PAGE_SIZE));

    await facade.goToPage(3, ALERT_PAGE_SIZE);

    expect(facade.pageIndex()).toBe(0);
    expect(facade.rows()).toHaveLength(ALERT_PAGE_SIZE);
    expect(alerts.list).toHaveBeenLastCalledWith('ranch-1', { status: null, cattleId: null }, 1, ALERT_PAGE_SIZE);
  });

  it('collects the filtered alerts in pages of the API maximum', async () => {
    await facade.open('ranch-1');
    alerts.list.mockClear();
    alerts.list.mockResolvedValueOnce(pageOf(Array.from({ length: 500 }, (_, index) => alert(`a-${index}`)), 501))
      .mockResolvedValueOnce(pageOf([alert('a-500')], 501));

    const rows = await facade.exportRows();

    expect(rows).toHaveLength(501);
    expect(alerts.list).toHaveBeenNthCalledWith(1, 'ranch-1', { status: null, cattleId: null }, 1, 500);
    expect(alerts.list).toHaveBeenNthCalledWith(2, 'ranch-1', { status: null, cattleId: null }, 2, 500);
  });
});
