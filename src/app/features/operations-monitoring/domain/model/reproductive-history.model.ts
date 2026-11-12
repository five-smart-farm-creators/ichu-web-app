import { DAY_MILLISECONDS, type PregnancyResult } from './livestock-operation.model';

/** A breeding service of a female, with the sire named for it when the farm knows it. */
export interface ReproductiveService {
  readonly occurredAt: string;
  readonly method: string;
  readonly sireReference: string | null;
}

/** A pregnancy diagnosis; the calving date is a calendar day and comes only with a pregnant result. */
export interface PregnancyDiagnosisRecord {
  readonly occurredAt: string;
  readonly result: PregnancyResult;
  readonly expectedCalvingDate: string | null;
}

/** A dated event such as a calving, an abortion or an observed heat. */
export interface ReproductiveEvent {
  readonly occurredAt: string;
}

/** The open period after a calving; the conception and the days stay null while no conception follows the calving. */
export interface CalvingInterval {
  readonly calvingAt: string;
  readonly conceptionServiceAt: string | null;
  readonly daysOpen: number | null;
}

/** The breeding history of an animal as the API derives it; a male has no history, only its sex, stage and age. */
export interface ReproductiveHistory {
  readonly cattleId: string;
  readonly sex: string;
  readonly lifeStage: string;
  readonly ageInMonths: number;
  readonly hasHistory: boolean;
  readonly services: readonly ReproductiveService[];
  readonly pregnancyDiagnoses: readonly PregnancyDiagnosisRecord[];
  readonly calvings: readonly ReproductiveEvent[];
  readonly abortions: readonly ReproductiveEvent[];
  readonly heatsObserved: readonly ReproductiveEvent[];
  readonly intervals: readonly CalvingInterval[];
  readonly servicesPerPregnancy: number | null;
  readonly pregnanciesConfirmed: number;
}

/** The kinds of dated event that the timeline lists. */
export type ReproductiveEventKind = 'service' | 'diagnosis' | 'calving' | 'abortion' | 'heat';

/** One dated entry of the timeline; the details that do not apply to its kind stay null. */
export interface ReproductiveTimelineEntry {
  readonly kind: ReproductiveEventKind;
  readonly occurredAt: string;
  readonly method: string | null;
  readonly result: PregnancyResult | null;
  readonly sireReference: string | null;
  readonly expectedCalvingDate: string | null;
}

/** Every dated event of the history, newest first. */
export function reproductiveTimeline(history: ReproductiveHistory): ReproductiveTimelineEntry[] {
  const entries: ReproductiveTimelineEntry[] = [
    ...history.services.map(service => timelineEntry('service', service.occurredAt, {
      method: service.method, sireReference: service.sireReference,
    })),
    ...history.pregnancyDiagnoses.map(diagnosis => timelineEntry('diagnosis', diagnosis.occurredAt, {
      result: diagnosis.result, expectedCalvingDate: diagnosis.expectedCalvingDate,
    })),
    ...history.calvings.map(event => timelineEntry('calving', event.occurredAt)),
    ...history.abortions.map(event => timelineEntry('abortion', event.occurredAt)),
    ...history.heatsObserved.map(event => timelineEntry('heat', event.occurredAt)),
  ];
  return entries.sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt));
}

/** The latest diagnosis when it confirms a pregnancy that no later calving or abortion ended; otherwise null. */
export function pregnancyInProgress(history: ReproductiveHistory): PregnancyDiagnosisRecord | null {
  const diagnosis = latestOf(history.pregnancyDiagnoses);
  if (!diagnosis || diagnosis.result !== 'Pregnant') return null;
  const endedLater = [...history.calvings, ...history.abortions]
    .some(event => Date.parse(event.occurredAt) > Date.parse(diagnosis.occurredAt));
  return endedLater ? null : diagnosis;
}

/** Whole local days from the last calving to `today`, counted while no pregnancy is in progress, so a lost pregnancy leaves the animal open again. */
export function currentDaysOpen(history: ReproductiveHistory, today: Date): number | null {
  const calving = latestOf(history.calvings);
  if (!calving || pregnancyInProgress(history)) return null;
  const days = Math.round((startOfLocalDay(today) - startOfLocalDay(new Date(calving.occurredAt))) / DAY_MILLISECONDS);
  return Math.max(days, 0);
}

/** The most recent calving, or null when the animal has never calved. */
export function latestCalving(history: ReproductiveHistory): ReproductiveEvent | null {
  return latestOf(history.calvings);
}

function timelineEntry(
  kind: ReproductiveEventKind,
  occurredAt: string,
  details: Partial<Omit<ReproductiveTimelineEntry, 'kind' | 'occurredAt'>> = {},
): ReproductiveTimelineEntry {
  return {
    kind,
    occurredAt,
    method: details.method ?? null,
    result: details.result ?? null,
    sireReference: details.sireReference ?? null,
    expectedCalvingDate: details.expectedCalvingDate ?? null,
  };
}

function latestOf<T extends { readonly occurredAt: string }>(items: readonly T[]): T | null {
  return items.reduce<T | null>(
    (latest, item) => (!latest || Date.parse(item.occurredAt) > Date.parse(latest.occurredAt) ? item : latest),
    null,
  );
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
