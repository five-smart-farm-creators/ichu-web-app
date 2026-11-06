import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  DecideHerdAdvisory, GrantHerdAdvisory, HerdAdvisoryRecord, RequestHerdAdvisory,
} from '../../domain/model/herd-advisory.model';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { IAM_CONFIG } from '../configuration/iam-config';
import { FirebaseAuthRepository } from './firebase-auth.repository';
import { iamAuthorizationHeaders, iamEndpoint, toIamRequestError } from './iam-http-support';

@Injectable()
export class IamHerdAdvisoryRepository extends HerdAdvisoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(IAM_CONFIG);
  private readonly authentication = inject(FirebaseAuthRepository);

  override async list(ranchId: string): Promise<readonly HerdAdvisoryRecord[]> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    const params = new HttpParams().set('ranchId', ranchId);
    try {
      return await firstValueFrom(this.http.get<readonly HerdAdvisoryRecord[]>(
        iamEndpoint(this.config, 'herd-advisories'), { headers, params },
      ));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async request(advisory: RequestHerdAdvisory): Promise<HerdAdvisoryRecord> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.post<HerdAdvisoryRecord>(
        iamEndpoint(this.config, 'herd-advisories'), advisory, { headers },
      ));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async decide(id: string, decision: DecideHerdAdvisory): Promise<HerdAdvisoryRecord> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.patch<HerdAdvisoryRecord>(
        iamEndpoint(this.config, 'herd-advisories/' + encodeURIComponent(id)), decision, { headers },
      ));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async grant(advisory: GrantHerdAdvisory): Promise<HerdAdvisoryRecord> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.post<HerdAdvisoryRecord>(
        iamEndpoint(this.config, 'herd-advisories/grants'), advisory, { headers },
      ));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }
}
