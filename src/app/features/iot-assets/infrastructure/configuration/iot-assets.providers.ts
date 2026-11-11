import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DeviceRepository } from '../../domain/repositories/device.repository';
import { EdgeGatewayRepository } from '../../domain/repositories/edge-gateway.repository';
import { WaterTroughRepository } from '../../domain/repositories/water-trough.repository';
import { RestDeviceRepository } from '../repositories/rest-device.repository';
import { RestEdgeGatewayRepository } from '../repositories/rest-edge-gateway.repository';
import { RestWaterTroughRepository } from '../repositories/rest-water-trough.repository';

/** Composes the device, water trough and edge gateway REST adapters of the IoT assets context. */
export function provideIotAssets(): EnvironmentProviders {
  return makeEnvironmentProviders([
    RestDeviceRepository,
    { provide: DeviceRepository, useExisting: RestDeviceRepository },
    RestWaterTroughRepository,
    { provide: WaterTroughRepository, useExisting: RestWaterTroughRepository },
    RestEdgeGatewayRepository,
    { provide: EdgeGatewayRepository, useExisting: RestEdgeGatewayRepository },
  ]);
}
