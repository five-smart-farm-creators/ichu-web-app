import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALERT_TYPES } from './alert.model';

const translations = JSON.parse(readFileSync(join(process.cwd(), 'public', 'i18n', 'en.json'), 'utf8')) as {
  monitoring: { alertType: Record<string, string> };
  analytics: { alertTypes: Record<string, string> };
};

describe('alert types', () => {
  it('include methane, which the API raises from the methane index', () => {
    expect(ALERT_TYPES).toContain('Methane');
  });

  it('have an English label on the alert pages and on the dashboard', () => {
    for (const type of ALERT_TYPES) {
      expect(translations.monitoring.alertType[type]).toBeTruthy();
      // The dashboard counts arrive with lowercase type names, such as heartrate and methane.
      expect(translations.analytics.alertTypes[type.toLowerCase()]).toBeTruthy();
    }
  });
});
