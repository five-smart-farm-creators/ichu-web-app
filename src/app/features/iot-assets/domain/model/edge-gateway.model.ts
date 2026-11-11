export const EDGE_GATEWAY_NAME_MAX_LENGTH = 80;

export type EdgeGatewayStatus = 'Active' | 'Revoked';

/** An edge node of a ranch that connects field devices to ICHU; a revoked node never connects again. */
export interface EdgeGateway {
  readonly id: string;
  readonly ranchId: string;
  readonly name: string;
  readonly status: EdgeGatewayStatus;
  readonly registeredAt: string;
  readonly revokedAt: string | null;
}

export interface RegisterEdgeGateway {
  readonly name: string;
}

/** The key is returned once, at registration, and is never part of the gateway record. */
export interface EdgeGatewayRegistration {
  readonly gateway: EdgeGateway;
  readonly key: string;
}
