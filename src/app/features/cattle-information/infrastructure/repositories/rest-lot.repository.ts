import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { CreateLot, Lot } from '../../domain/model/lot.model';
import { LotRepository } from '../../domain/repositories/lot.repository';
import { firstCattleResponse } from '../http/cattle-http';

/** Calls the lot endpoints of the ICHU API; membership changes send the lot's version. */
@Injectable()
export class RestLotRepository extends LotRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string): Promise<readonly Lot[]> {
    return firstCattleResponse(this.http.get<readonly Lot[]>(this.collectionUrl(ranchId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override create(ranchId: string, request: CreateLot): Promise<Lot> {
    return firstCattleResponse(this.http.post<Lot>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override assignCattle(ranchId: string, lotId: string, cattleId: string, expectedVersion: string): Promise<Lot> {
    return firstCattleResponse(this.http.put<Lot>(this.membershipUrl(ranchId, lotId, cattleId), { expectedVersion }, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override removeCattle(ranchId: string, lotId: string, cattleId: string, expectedVersion: string): Promise<Lot> {
    const params = new HttpParams().set('expectedVersion', expectedVersion);
    return firstCattleResponse(this.http.delete<Lot>(this.membershipUrl(ranchId, lotId, cattleId), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/lots`);
  }

  private membershipUrl(ranchId: string, lotId: string, cattleId: string): string {
    return `${this.collectionUrl(ranchId)}/${encodeURIComponent(lotId)}/cattle/${encodeURIComponent(cattleId)}`;
  }
}
