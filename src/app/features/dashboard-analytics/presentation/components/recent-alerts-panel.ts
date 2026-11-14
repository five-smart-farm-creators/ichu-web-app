import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatLocaleTag } from '../../../../shared/infrastructure/i18n/language';
import { LanguageService } from '../../../../shared/infrastructure/i18n/language.service';
import { ApiErrorMessagePipe } from '../../../../shared/presentation/api-error-message.pipe';
import { Icon, type IconName } from '../../../../shared/presentation/icon';
import { pluralTranslationKey } from '../../../../shared/presentation/plural.pipe';
import { relativeTime } from '../../../../shared/presentation/relative-time';
import { HerdDashboardFacade, type RecentAlert } from '../../application/services/herd-dashboard.facade';
import { formatAnalyticsNumber } from '../analytics-format';
import { type StatTone } from './indicator-tile';

/** How each alert type reads on the dashboard: its tone, its icon and the key of its label. */
const ALERT_STYLES: Readonly<Record<RecentAlert['type'], { readonly tone: StatTone; readonly icon: IconName; readonly typeKey: string }>> = {
  Temperature: { tone: 'danger', icon: 'thermometer', typeKey: 'analytics.alertTypes.temperature' },
  Geofence: { tone: 'warning', icon: 'pin', typeKey: 'analytics.alertTypes.geofence' },
  Activity: { tone: 'accent', icon: 'pulse', typeKey: 'analytics.alertTypes.activity' },
  HeartRate: { tone: 'danger', icon: 'health', typeKey: 'analytics.alertTypes.heartrate' },
};

/** One alert line with its measure and time already formatted for the current language. */
interface AlertRow {
  readonly alertId: string;
  readonly earTag: string | null;
  readonly tone: StatTone;
  readonly icon: IconName;
  readonly typeKey: string;
  readonly critical: boolean;
  readonly measure: string;
  readonly raisedAt: string;
  readonly relative: string;
}

/** The newest open alerts of the ranch and the connectivity of its collars, shown beside the temperature chart. */
@Component({
  selector: 'ichu-recent-alerts-panel',
  imports: [ApiErrorMessagePipe, Icon, MatProgressBarModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-alerts-panel.html',
  styleUrl: './recent-alerts-panel.scss',
})
export class RecentAlertsPanel {
  readonly facade = inject(HerdDashboardFacade);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  /** True while the dashboard is still opening, so an empty list is not reported before the reads finish. */
  readonly loading = input(false);

  readonly rows = computed<readonly AlertRow[]>(() => {
    const locale = formatLocaleTag(this.language.current());
    const now = new Date();
    return this.facade.alerts().map(alert => {
      const style = ALERT_STYLES[alert.type];
      const geofence = alert.type === 'Geofence';
      const value = formatAnalyticsNumber(geofence ? alert.distanceToBoundaryMeters : alert.detectedValue, locale, geofence ? 0 : 1);
      const unit = this.unitLabel(alert);
      return {
        alertId: alert.alertId,
        earTag: alert.earTag,
        tone: style.tone,
        icon: style.icon,
        typeKey: style.typeKey,
        critical: alert.severity === 'Critical',
        measure: unit ? `${value} ${unit}` : value,
        raisedAt: alert.raisedAt,
        relative: relativeTime(new Date(alert.raisedAt), now, locale),
      };
    });
  });

  readonly collarTotal = computed(() => {
    const collars = this.facade.collars();
    return collars ? collars.communicating + collars.noCommunication + collars.neverReported : 0;
  });

  /** Only the statuses with collars get a segment, so no empty segment steals a gap from the bar. */
  readonly collarSegments = computed(() => {
    const collars = this.facade.collars();
    if (!collars) return [];
    return [
      { status: 'communicating', count: collars.communicating },
      { status: 'silent', count: collars.noCommunication },
      { status: 'never', count: collars.neverReported },
    ].filter(segment => segment.count > 0);
  });

  /** The same sentence is the visible summary and the accessible name of the bar. */
  readonly collarSummary = computed(() => {
    const collars = this.facade.collars();
    const language = this.language.current();
    if (!collars) return '';
    return [
      this.translate.instant(pluralTranslationKey('analytics.dashboard.collars.connected', collars.communicating, language), { count: collars.communicating }),
      this.translate.instant('analytics.dashboard.collars.silent', { count: collars.noCommunication }),
      this.translate.instant('analytics.dashboard.collars.never', { count: collars.neverReported }),
    ].join(' · ');
  });

  private unitLabel(alert: RecentAlert): string {
    if (alert.type === 'Geofence') return this.translate.instant('monitoring.units.meters');
    return alert.unit ? this.translate.instant(`monitoring.units.${alert.unit}`) : '';
  }
}
