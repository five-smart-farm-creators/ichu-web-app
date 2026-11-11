/** Breed codes; the API and the screens exchange them as text. */
export const CATTLE_BREEDS = ['BrownSwiss', 'Fleckvieh', 'Criollo', 'Crossbred'] as const;
export type CattleBreed = (typeof CATTLE_BREEDS)[number];

export const CATTLE_SEXES = ['Female', 'Male'] as const;
export type CattleSex = (typeof CATTLE_SEXES)[number];

/** Productive stages; the API never infers one from age or sex. */
export const LIFE_STAGES = ['Calf', 'Heifer', 'MilkingCow', 'FatteningBull'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const CATTLE_STATUSES = ['Active', 'Inactive'] as const;
export type CattleStatus = (typeof CATTLE_STATUSES)[number];

export const EXIT_REASONS = ['Death', 'Sale', 'Theft', 'Culling'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

/** The API trims the ear tag before it applies this limit. */
export const EAR_TAG_MAX_LENGTH = 30;

/** Shared code for every version mismatch, so screens reload the record and show one message. */
export const VERSION_CONFLICT = 'version-conflict';

/** A productive stage; `validTo` is exclusive and null marks the open period. */
export interface StagePeriod {
  readonly id: string;
  readonly lifeStage: LifeStage;
  readonly validFrom: string;
  readonly validTo: string | null;
}

/** An animal of a ranch; `version` must accompany every change to it. */
export interface Cattle {
  readonly id: string;
  readonly ranchId: string;
  readonly earTag: string;
  readonly breed: CattleBreed;
  readonly sex: CattleSex;
  readonly birthDate: string;
  readonly currentStage: LifeStage;
  readonly status: CattleStatus;
  readonly exitReason: ExitReason | null;
  readonly exitDate: string | null;
  readonly version: string;
  readonly stagePeriods: readonly StagePeriod[];
}

/** Inventory filters; an absent value is not sent to the API. */
export interface CattleFilter {
  readonly earTag?: string;
  readonly status?: CattleStatus;
  readonly lotId?: string;
}

export interface RegisterCattle {
  readonly earTag: string;
  readonly breed: CattleBreed;
  readonly sex: CattleSex;
  readonly birthDate: string;
  readonly lifeStage: LifeStage;
}

export interface UpdateCattle {
  readonly earTag: string;
  readonly breed: CattleBreed;
  readonly sex: CattleSex;
  readonly birthDate: string;
  readonly expectedVersion: string;
}

export interface ChangeLifeStage {
  readonly lifeStage: LifeStage;
  readonly validFrom: string;
  readonly expectedVersion: string;
}

export interface RecordExit {
  readonly reason: ExitReason;
  readonly exitDate: string;
  readonly expectedVersion: string;
}

/** Formats a calendar day as the API's yyyy-MM-dd, using the local day rather than UTC. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Reads a yyyy-MM-dd day as local midnight, so the day shown in a date picker is the day the API stored. */
export function fromIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The earliest day a stage change or an exit may take effect: the current stage's start, never before birth. */
export function earliestEffectiveDay(animal: Cattle): string {
  const currentStart = animal.stagePeriods.find(period => period.validTo === null)?.validFrom ?? animal.birthDate;
  return currentStart > animal.birthDate ? currentStart : animal.birthDate;
}

/** Counts whole months between two yyyy-MM-dd days; a future birth date reads as zero. */
export function ageInMonths(birthDate: string, today: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  const months = (currentYear - birthYear) * 12 + (currentMonth - birthMonth) - (currentDay < birthDay ? 1 : 0);
  return Math.max(0, months);
}
