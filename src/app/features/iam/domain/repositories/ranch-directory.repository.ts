import type { RanchSummary } from '../model/ranch-summary.model';

/** Resolves a ranch access code to its ranch; an unknown code resolves to null, not an error. */
export abstract class RanchDirectoryRepository {
  abstract findByAccessCode(code: string): Promise<RanchSummary | null>;
}
