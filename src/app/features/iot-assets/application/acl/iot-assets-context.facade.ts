import { inject, Injectable } from '@angular/core';
import { DeviceRepository } from '../../domain/repositories/device.repository';

/** Collar counts by communication status and low battery, as the dashboard shows them. */
export interface CollarConnectivity {
  readonly communicating: number;
  readonly noCommunication: number;
  readonly neverReported: number;
  readonly lowBattery: number;
}

/** Publishes collar counts to other contexts, which never import this context's device models. */
@Injectable()
export class IotAssetsContextFacade {
  private readonly devices = inject(DeviceRepository);

  /** Counts only the collars; water controllers have their own status and are not part of the herd's collar health. */
  async collarConnectivity(ranchId: string): Promise<CollarConnectivity> {
    const collars = (await this.devices.list(ranchId)).filter(device => device.type === 'SmartCollar');
    return {
      communicating: collars.filter(collar => collar.communicationStatus === 'Communicating').length,
      noCommunication: collars.filter(collar => collar.communicationStatus === 'NoCommunication').length,
      neverReported: collars.filter(collar => collar.communicationStatus === 'NeverReported').length,
      lowBattery: collars.filter(collar => collar.isBatteryLow === true).length,
    };
  }
}
