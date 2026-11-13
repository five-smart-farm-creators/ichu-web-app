import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { IamContextFacade } from '../../application/acl/iam-context.facade';
import { AuthFacade } from '../../application/services/auth.facade';
import { AccountRepository } from '../../domain/repositories/account.repository';
import { AuthenticationRepository } from '../../domain/repositories/authentication.repository';
import { ProfessionalProfileRepository } from '../../domain/repositories/professional-profile.repository';
import { HerdAdvisoryRepository } from '../../domain/repositories/herd-advisory.repository';
import { RanchDirectoryRepository } from '../../domain/repositories/ranch-directory.repository';
import { FirebaseAuthRepository } from '../repositories/firebase-auth.repository';
import { IamAccountRepository } from '../repositories/iam-account.repository';
import { IamProfessionalProfileRepository } from '../repositories/iam-professional-profile.repository';
import { IamHerdAdvisoryRepository } from '../repositories/iam-herd-advisory.repository';
import { IamRanchDirectoryRepository } from '../repositories/iam-ranch-directory.repository';

/** Composes Firebase identity, the IAM API adapters, and the ranch context facade for other contexts. */
export function provideIam(): EnvironmentProviders {
  return makeEnvironmentProviders([
    FirebaseAuthRepository,
    { provide: AuthenticationRepository, useExisting: FirebaseAuthRepository },
    IamAccountRepository,
    { provide: AccountRepository, useExisting: IamAccountRepository },
    IamProfessionalProfileRepository,
    { provide: ProfessionalProfileRepository, useExisting: IamProfessionalProfileRepository },
    IamHerdAdvisoryRepository,
    { provide: HerdAdvisoryRepository, useExisting: IamHerdAdvisoryRepository },
    IamRanchDirectoryRepository,
    { provide: RanchDirectoryRepository, useExisting: IamRanchDirectoryRepository },
    AuthFacade,
    IamContextFacade,
  ]);
}
