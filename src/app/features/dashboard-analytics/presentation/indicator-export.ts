import type { TranslateService } from '@ngx-translate/core';
import {
  type HerdIndicators, INDICATOR_KEYS, type IndicatorKey, type IndicatorValue, isIndicatorAvailable,
} from '../domain/model/herd-indicators.model';
import type { ExportColumn } from '../../../shared/presentation/export/table-export.service';
import { analyticsTextKey } from './analytics-text';

/** One indicator of a report, keyed by the name the screens translate. */
export interface IndicatorRow {
  readonly key: IndicatorKey;
  readonly indicator: IndicatorValue;
}

/** The report's indicators in display order. */
export function indicatorRows(report: HerdIndicators): IndicatorRow[] {
  return INDICATOR_KEYS.map(key => ({ key, indicator: report[key] }));
}

/** Columns of the indicator table in Excel and PDF; an unavailable value stays empty and its reason is in the note. */
export function indicatorExportColumns(translate: TranslateService): ExportColumn<IndicatorRow>[] {
  const text = (key: string): string => translate.instant(key);
  return [
    { header: text('analytics.export.indicator'), value: row => text(`analytics.indicators.${row.key}`) },
    { header: text('analytics.export.value'), value: row => (isIndicatorAvailable(row.indicator) ? row.indicator.value : null) },
    { header: text('analytics.export.unit'), value: row => text(`analytics.units.${row.indicator.unit}`) },
    { header: text('analytics.export.formula'), value: row => text(analyticsTextKey(row.indicator.formula)) },
    { header: text('analytics.export.denominator'), value: row => row.indicator.denominator },
    {
      header: text('analytics.export.note'),
      value: row => (row.indicator.unavailableReason ? text(analyticsTextKey(row.indicator.unavailableReason)) : null),
    },
  ];
}
