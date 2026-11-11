import { inject, Injectable, signal } from '@angular/core';
import { ApiError, toApiError } from '../../../../shared/infrastructure/http/api-error';
import type { EdgeGateway, EdgeGatewayRegistration } from '../../domain/model/edge-gateway.model';
import { EdgeGatewayRepository } from '../../domain/repositories/edge-gateway.repository';

/** Coordinates the edge gateways of one ranch: listing, registration and revocation. */
@Injectable()
export class EdgeGatewaysFacade {
  private readonly gatewayRepository = inject(EdgeGatewayRepository);
  private ranchId: string | null = null;
  private requestId = 0;

  readonly gateways = signal<readonly EdgeGateway[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  /** Shows the ranch's gateways; a null ranch clears them. */
  async open(ranchId: string | null): Promise<void> {
    this.ranchId = ranchId;
    this.gateways.set([]);
    this.error.set(null);
    if (!ranchId) return;
    await this.load(ranchId);
  }

  /** Lists the new gateway and returns its key to the caller only; the facade keeps no copy of the key. */
  async register(name: string): Promise<EdgeGatewayRegistration> {
    const ranchId = this.requireRanch();
    const registration = await this.gatewayRepository.register(ranchId, { name: name.trim() });
    this.gateways.update(gateways => [...gateways, registration.gateway]
      .sort((first, second) => first.name.localeCompare(second.name)));
    return registration;
  }

  /** A refusal with status 409, such as an already revoked gateway, reloads the list so it shows the current state. */
  async revoke(gatewayId: string): Promise<void> {
    const ranchId = this.requireRanch();
    try {
      const revoked = await this.gatewayRepository.revoke(ranchId, gatewayId);
      this.gateways.update(gateways => gateways.map(gateway => (gateway.id === revoked.id ? revoked : gateway)));
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 409) await this.load(ranchId);
      throw apiError;
    }
  }

  private requireRanch(): string {
    if (!this.ranchId) throw new ApiError(0, 'unknown', null);
    return this.ranchId;
  }

  private async load(ranchId: string): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const gateways = await this.gatewayRepository.list(ranchId);
      if (request !== this.requestId) return;
      this.gateways.set([...gateways].sort((first, second) => first.name.localeCompare(second.name)));
    } catch (error) {
      if (request !== this.requestId) return;
      this.error.set(toApiError(error));
    } finally {
      if (request === this.requestId) this.loading.set(false);
    }
  }
}
