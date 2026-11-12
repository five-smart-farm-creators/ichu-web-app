import { campaignStatus, isValidCampaignRange } from './planning-campaign.model';

describe('campaignStatus', () => {
  const campaign = { startsOn: '2026-11-10', endsOn: '2026-11-12' };

  it('is upcoming before the first day', () => {
    expect(campaignStatus(campaign, '2026-11-09')).toBe('Upcoming');
  });

  it('is active from the first day through the last day, both included', () => {
    expect(campaignStatus(campaign, '2026-11-10')).toBe('Active');
    expect(campaignStatus(campaign, '2026-11-12')).toBe('Active');
  });

  it('is finished after the last day', () => {
    expect(campaignStatus(campaign, '2026-11-13')).toBe('Finished');
  });
});

describe('isValidCampaignRange', () => {
  it('accepts a one-day campaign and rejects an end before the start', () => {
    expect(isValidCampaignRange('2026-11-10', '2026-11-10')).toBe(true);
    expect(isValidCampaignRange('2026-11-11', '2026-11-10')).toBe(false);
  });
});
