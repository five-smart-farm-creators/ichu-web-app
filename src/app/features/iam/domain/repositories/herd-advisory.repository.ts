import type {
  DecideHerdAdvisory, GrantHerdAdvisory, HerdAdvisoryRecord, RequestHerdAdvisory,
} from '../model/herd-advisory.model';

/** Defines authenticated herd-advisory operations exposed by the IAM API. */
export abstract class HerdAdvisoryRepository {
  abstract list(ranchId: string): Promise<readonly HerdAdvisoryRecord[]>;
  abstract request(advisory: RequestHerdAdvisory): Promise<HerdAdvisoryRecord>;
  abstract decide(id: string, decision: DecideHerdAdvisory): Promise<HerdAdvisoryRecord>;
  abstract grant(advisory: GrantHerdAdvisory): Promise<HerdAdvisoryRecord>;
}
