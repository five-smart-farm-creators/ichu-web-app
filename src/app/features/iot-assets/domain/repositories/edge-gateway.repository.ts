import type { EdgeGateway, EdgeGatewayRegistration, RegisterEdgeGateway } from '../model/edge-gateway.model';

/** Defines edge gateway operations backed by the edge gateways REST API; every call is scoped to one ranch. */
export abstract class EdgeGatewayRepository {
  abstract list(ranchId: string): Promise<readonly EdgeGateway[]>;
  abstract register(ranchId: string, request: RegisterEdgeGateway): Promise<EdgeGatewayRegistration>;
  abstract revoke(ranchId: string, gatewayId: string): Promise<EdgeGateway>;
}
