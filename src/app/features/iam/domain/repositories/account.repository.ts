import type {
  IamAccount, RanchAccess, RegisterAccountRequest,
} from '../model/auth.model';

/** Defines account and ranch-access operations backed by the IAM REST API. */
export abstract class AccountRepository {
  abstract isConfigured(): boolean;
  abstract registerAccount(request: RegisterAccountRequest): Promise<void>;
  abstract currentAccount(): Promise<IamAccount>;
  abstract ranchAccess(): Promise<readonly RanchAccess[]>;
}
