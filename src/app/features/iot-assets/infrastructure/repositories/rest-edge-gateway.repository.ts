import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type {
  EdgeGateway, EdgeGatewayRegistration, EdgeGatewayStatus, RegisterEdgeGateway,
} from '../../domain/model/edge-gateway.model';
import { EdgeGatewayRepository } from '../../domain/repositories/edge-gateway.repository';
import { firstIotAssetsResponse } from '../http/iot-assets-http';

/** The registration response is the only one that carries the key; the record fields are split out from it. */
interface EdgeGatewayRegistrationPayload {
  readonly id: string;
  readonly ranchId: string;
  readonly name: string;
  readonly status: EdgeGatewayStatus;
  readonly registeredAt: string;
  readonly key: string;
}

/** Calls the edge gateway endpoints of the ICHU API; every URL is scoped to the ranch. */
@Injectable()
export class RestEdgeGatewayRepository extends EdgeGatewayRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly EdgeGateway[]> {
    return firstIotAssetsResponse(this.http.get<readonly EdgeGateway[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override async register(ranchId: string, request: RegisterEdgeGateway): Promise<EdgeGatewayRegistration> {
    const payload = await firstIotAssetsResponse(
      this.http.post<EdgeGatewayRegistrationPayload>(this.collectionUrl(ranchId), request, { timeout: API_REQUEST_TIMEOUT_MS }),
    );
    return {
      gateway: {
        id: payload.id,
        ranchId: payload.ranchId,
        name: payload.name,
        status: payload.status,
        registeredAt: payload.registeredAt,
        revokedAt: null,
      },
      key: payload.key,
    };
  }

  override revoke(ranchId: string, gatewayId: string): Promise<EdgeGateway> {
    const url = `${this.collectionUrl(ranchId)}/${encodeURIComponent(gatewayId)}/revocations`;
    return firstIotAssetsResponse(this.http.post<EdgeGateway>(url, null, { timeout: API_REQUEST_TIMEOUT_MS }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/edge-gateways`);
  }
}
