/** Open alerts and follow-up counts of one ranch; a null count is unavailable, never zero. */
export interface RanchPortfolioEntry {
  readonly ranchId: string;
  readonly updatedAt: string;
  readonly source: string;
  readonly criticalAlerts: number;
  readonly warningAlerts: number;
  readonly informativeAlerts: number;
  readonly unresponsiveTreatmentAnimals: number | null;
  readonly overdueCampaigns: number | null;
}

/** Puts the ranches that need attention first: critical, then warning, then informative alerts. */
export function sortByAttention(entries: readonly RanchPortfolioEntry[]): RanchPortfolioEntry[] {
  return [...entries].sort((first, second) =>
    second.criticalAlerts - first.criticalAlerts
    || second.warningAlerts - first.warningAlerts
    || second.informativeAlerts - first.informativeAlerts
    || first.ranchId.localeCompare(second.ranchId));
}
