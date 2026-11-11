import type {
  DecideHerdAdvisory, HerdAdvisoryRecord, RequestHerdAdvisory,
} from '../model/herd-advisory.model';

/** Defines ranch-scoped herd-advisory operations exposed by the IAM API. */
export abstract class HerdAdvisoryRepository {
  abstract list(ranchId: string): Promise<readonly HerdAdvisoryRecord[]>;
  abstract request(ranchId: string, advisory: RequestHerdAdvisory): Promise<HerdAdvisoryRecord>;
  abstract decide(ranchId: string, id: string, decision: DecideHerdAdvisory): Promise<HerdAdvisoryRecord>;
}
