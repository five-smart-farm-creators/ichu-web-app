import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { IamAccount } from '../../domain/model/auth.model';
import type { CompleteProfessionalProfile } from '../../domain/model/professional-profile.model';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { IAM_CONFIG } from '../configuration/iam-config';
import { FirebaseAuthRepository } from './firebase-auth.repository';
import { iamAuthorizationHeaders, iamEndpoint, toIamRequestError } from './iam-http-support';

@Injectable()
export class IamProfessionalProfileRepository extends ProfessionalProfileRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(IAM_CONFIG);
  private readonly authentication = inject(FirebaseAuthRepository);

  override async current(): Promise<IamAccount> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.get<IamAccount>(iamEndpoint(this.config, 'profiles/me'), { headers }));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }

  override async complete(profile: CompleteProfessionalProfile): Promise<IamAccount> {
    const headers = await iamAuthorizationHeaders(this.authentication);
    try {
      return await firstValueFrom(this.http.put<IamAccount>(iamEndpoint(this.config, 'profiles/me'), profile, { headers }));
    } catch (error) {
      throw toIamRequestError(error);
    }
  }
}
