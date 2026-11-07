import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthFacade } from '../../application/services/auth.facade';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { IAM_CONFIG, IamConfig } from './iam-config';
import { FirebaseAuthRepository } from '../repositories/firebase-auth.repository';
import { IamAccountRepository } from '../repositories/iam-account.repository';
import { IamProfessionalProfileRepository } from '../repositories/iam-professional-profile.repository';
import { IamHerdAdvisoryRepository } from '../repositories/iam-herd-advisory.repository';

/** Composes Firebase identity and the authenticated IAM API adapters. */
export function provideIam(config: IamConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: IAM_CONFIG, useValue: config },
    FirebaseAuthRepository,
    { provide: AuthenticationRepository, useExisting: FirebaseAuthRepository },
    IamAccountRepository,
    { provide: AccountRepository, useExisting: IamAccountRepository },
    IamProfessionalProfileRepository,
    { provide: ProfessionalProfileRepository, useExisting: IamProfessionalProfileRepository },
    IamHerdAdvisoryRepository,
    { provide: HerdAdvisoryRepository, useExisting: IamHerdAdvisoryRepository },
    AuthFacade,
  ]);
}
