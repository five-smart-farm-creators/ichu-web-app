/** Planning purposes; the API and the screens exchange them as text. */
export const CAMPAIGN_KINDS = ['Sanitary', 'Reproductive'] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_STATUSES = ['Upcoming', 'Active', 'Finished'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Groups the activities of one ranch over an inclusive range of calendar days (yyyy-MM-dd). */
export interface PlanningCampaign {
  readonly id: string;
  readonly name: string;
  readonly kind: CampaignKind;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface CreatePlanningCampaign {
  readonly name: string;
  readonly kind: CampaignKind;
  readonly startsOn: string;
  readonly endsOn: string;
}

/** Days are compared as yyyy-MM-dd text, which sorts in calendar order. */
export function campaignStatus(campaign: Pick<PlanningCampaign, 'startsOn' | 'endsOn'>, today: string): CampaignStatus {
  if (today < campaign.startsOn) return 'Upcoming';
  return today > campaign.endsOn ? 'Finished' : 'Active';
}

/** The API rejects a campaign that ends before it starts; equal days are valid because both ends are inclusive. */
export function isValidCampaignRange(startsOn: string, endsOn: string): boolean {
  return endsOn >= startsOn;
}
