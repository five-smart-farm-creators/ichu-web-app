import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../shared/infrastructure/http/api-error';
import type { EdgeGateway } from '../../domain/model/edge-gateway.model';
import { EdgeGatewayRepository } from '../../domain/repositories/edge-gateway.repository';
import { EdgeGatewaysFacade } from './edge-gateways.facade';

const RANCH = 'ranch-1';

function gateway(id: string, name: string, overrides: Partial<EdgeGateway> = {}): EdgeGateway {
  return {
    id, ranchId: RANCH, name, status: 'Active', registeredAt: '2026-11-01T08:00:00Z', revokedAt: null, ...overrides,
  };
}

describe('EdgeGatewaysFacade', () => {
  let facade: EdgeGatewaysFacade;
  let gatewayRepository: {
    list: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    gatewayRepository = { list: vi.fn(async () => [] as EdgeGateway[]), register: vi.fn(), revoke: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [EdgeGatewaysFacade, { provide: EdgeGatewayRepository, useValue: gatewayRepository }],
    });
    facade = TestBed.inject(EdgeGatewaysFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns the key to the caller and keeps it out of the facade state', async () => {
    await facade.open(RANCH);
    gatewayRepository.register.mockResolvedValue({ gateway: gateway('gateway-1', 'North'), key: 'gateway-1.secret-value' });

    const registration = await facade.register('  North  ');

    expect(gatewayRepository.register).toHaveBeenCalledWith(RANCH, { name: 'North' });
    expect(registration.key).toBe('gateway-1.secret-value');
    expect(facade.gateways().map(item => item.name)).toEqual(['North']);
    expect(JSON.stringify(facade.gateways())).not.toContain('secret-value');
  });

  it('replaces a gateway with the record returned by its revocation', async () => {
    gatewayRepository.list.mockResolvedValue([gateway('gateway-1', 'North')]);
    await facade.open(RANCH);
    gatewayRepository.revoke.mockResolvedValue(gateway('gateway-1', 'North', {
      status: 'Revoked', revokedAt: '2026-11-11T09:00:00Z',
    }));

    await facade.revoke('gateway-1');

    expect(gatewayRepository.revoke).toHaveBeenCalledWith(RANCH, 'gateway-1');
    expect(facade.gateways()[0].status).toBe('Revoked');
  });

  it('reloads the list when the gateway was already revoked, so the screen shows its current state', async () => {
    gatewayRepository.list.mockResolvedValue([gateway('gateway-1', 'North')]);
    await facade.open(RANCH);
    gatewayRepository.revoke.mockRejectedValue(new ApiError(409, 'IoTAssets.EdgeGatewayAlreadyRevoked', 'Already revoked.'));

    await expect(facade.revoke('gateway-1')).rejects.toMatchObject({ code: 'IoTAssets.EdgeGatewayAlreadyRevoked' });
    expect(gatewayRepository.list).toHaveBeenCalledTimes(2);
  });
});
