import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { API_REQUEST_TIMEOUT_MS, apiEndpoint } from '../../../../shared/infrastructure/http/api-endpoint';
import type { CattleProfile } from '../../domain/model/cattle-profile.model';
import type {
  ChangeLifeStage, Cattle, CattleFilter, RecordExit, RegisterCattle, UpdateCattle,
} from '../../domain/model/cattle.model';
import { CattleRepository } from '../../domain/repositories/cattle.repository';
import { firstCattleResponse } from '../http/cattle-http';

/** Calls the cattle endpoints of the ICHU API; every URL is scoped to the ranch. */
@Injectable()
export class RestCattleRepository extends CattleRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  override list(ranchId: string, filter: CattleFilter, page: number, pageSize: number): Promise<readonly Cattle[]> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filter.earTag) params = params.set('earTag', filter.earTag);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.lotId) params = params.set('lotId', filter.lotId);
    return firstCattleResponse(this.http.get<readonly Cattle[]>(this.collectionUrl(ranchId), {
      params, timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override profile(ranchId: string, cattleId: string): Promise<CattleProfile> {
    return firstCattleResponse(this.http.get<CattleProfile>(this.itemUrl(ranchId, cattleId), {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override register(ranchId: string, request: RegisterCattle): Promise<Cattle> {
    return firstCattleResponse(this.http.post<Cattle>(this.collectionUrl(ranchId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override update(ranchId: string, cattleId: string, request: UpdateCattle): Promise<Cattle> {
    return firstCattleResponse(this.http.put<Cattle>(this.itemUrl(ranchId, cattleId), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override changeLifeStage(ranchId: string, cattleId: string, request: ChangeLifeStage): Promise<Cattle> {
    return firstCattleResponse(this.http.patch<Cattle>(this.itemUrl(ranchId, cattleId, '/life-stage'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  override recordExit(ranchId: string, cattleId: string, request: RecordExit): Promise<Cattle> {
    return firstCattleResponse(this.http.post<Cattle>(this.itemUrl(ranchId, cattleId, '/deactivations'), request, {
      timeout: API_REQUEST_TIMEOUT_MS,
    }));
  }

  private collectionUrl(ranchId: string): string {
    return apiEndpoint(this.config.apiBaseUrl, `ranches/${encodeURIComponent(ranchId)}/cattle`);
  }

  private itemUrl(ranchId: string, cattleId: string, suffix = ''): string {
    return `${this.collectionUrl(ranchId)}/${encodeURIComponent(cattleId)}${suffix}`;
  }
}
