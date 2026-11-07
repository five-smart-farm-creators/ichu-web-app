import type { CompleteProfessionalProfile } from '../model/professional-profile.model';
import type { IamAccount } from '../model/auth.model';

/** Defines the authenticated professional-profile REST contract. */
export abstract class ProfessionalProfileRepository {
  abstract current(): Promise<IamAccount>;
  abstract complete(profile: CompleteProfessionalProfile): Promise<IamAccount>;
}
