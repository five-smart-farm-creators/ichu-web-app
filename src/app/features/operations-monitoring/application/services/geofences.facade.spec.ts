import { TestBed } from '@angular/core/testing';
import { CattleInformationContextFacade } from '../../../cattle-information/application/acl/cattle-information-context.facade';
import type { Geofence, GeoPoint } from '../../domain/model/geofence.model';
import { GeofenceRepository } from '../../domain/repositories/geofence.repository';
import { GeofencesFacade } from './geofences.facade';

const square: GeoPoint[] = [
  { latitude: -12.1, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.1 },
  { latitude: -12.2, longitude: -77.0 },
];

function geofence(id: string, lotId: string, name: string): Geofence {
  return { geofenceId: id, lotId, name, toleranceMeters: 10, severity: 'Warning', revision: 1, vertices: square };
}

describe('GeofencesFacade', () => {
  let facade: GeofencesFacade;
  let repository: { list: ReturnType<typeof vi.fn>; define: ReturnType<typeof vi.fn>; redefine: ReturnType<typeof vi.fn> };
  let cattleContext: { lotSummaries: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = {
      list: vi.fn(async () => [geofence('geofence-1', 'lot-1', 'North')]),
      define: vi.fn(async () => geofence('geofence-2', 'lot-2', 'South')),
      redefine: vi.fn(async () => geofence('geofence-1', 'lot-1', 'North edge')),
    };
    cattleContext = { lotSummaries: vi.fn(async () => [{ lotId: 'lot-1', name: 'Heifers' }, { lotId: 'lot-2', name: 'Calves' }]) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        GeofencesFacade,
        { provide: GeofenceRepository, useValue: repository },
        { provide: CattleInformationContextFacade, useValue: cattleContext },
      ],
    });
    facade = TestBed.inject(GeofencesFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('offers only lots that do not have a geofence yet', async () => {
    await facade.open('ranch-1');

    expect(facade.geofences().map(item => item.name)).toEqual(['North']);
    expect(facade.lotsWithoutGeofence().map(lot => lot.lotId)).toEqual(['lot-2']);
  });

  it('edits the drawn boundary with undo and clear, and discards it on cancel', async () => {
    await facade.open('ranch-1');
    facade.startDefining('lot-2');
    square.forEach(point => facade.addVertex(point));

    expect(facade.draft()?.vertices).toHaveLength(3);
    facade.undoVertex();
    expect(facade.draft()?.vertices).toHaveLength(2);
    facade.clearVertices();
    expect(facade.draft()?.vertices).toEqual([]);
    facade.cancelEditing();
    expect(facade.draft()).toBeNull();
  });

  it('defines a geofence for the chosen lot with the trimmed name and the drawn vertices', async () => {
    await facade.open('ranch-1');
    facade.startDefining('lot-2');
    square.forEach(point => facade.addVertex(point));

    const saved = await facade.save({ lotId: 'lot-2', name: '  South  ', toleranceMeters: 12, severity: 'Critical' });

    expect(repository.define).toHaveBeenCalledWith('ranch-1', {
      lotId: 'lot-2', name: 'South', toleranceMeters: 12, severity: 'Critical', vertices: square,
    });
    expect(saved.geofenceId).toBe('geofence-2');
    expect(facade.geofences().map(item => item.name)).toEqual(['North', 'South']);
    expect(facade.draft()).toBeNull();
  });

  it('redefines an existing geofence without sending its lot', async () => {
    await facade.open('ranch-1');
    facade.startRedefining(geofence('geofence-1', 'lot-1', 'North'));

    await facade.save({ lotId: 'lot-1', name: 'North edge', toleranceMeters: 20, severity: 'Warning' });

    expect(repository.redefine).toHaveBeenCalledWith('ranch-1', 'geofence-1', {
      name: 'North edge', toleranceMeters: 20, severity: 'Warning', vertices: square,
    });
    expect(facade.geofences().map(item => item.name)).toEqual(['North edge']);
  });
});
