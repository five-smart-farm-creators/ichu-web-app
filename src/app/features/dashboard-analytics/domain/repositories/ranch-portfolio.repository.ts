import type { RanchPortfolioEntry } from '../model/ranch-portfolio.model';

/** Reads the attention summary of every ranch the account can access. */
export abstract class RanchPortfolioRepository {
  abstract list(): Promise<readonly RanchPortfolioEntry[]>;
}
