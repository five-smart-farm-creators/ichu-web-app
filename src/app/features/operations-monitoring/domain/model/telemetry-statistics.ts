/** The normal range that readings are checked against; a value outside it exceeds the threshold. */
export interface ThresholdBand {
  readonly min: number;
  readonly max: number;
}

/** Statistics of the valid readings of one metric; a field without data is null, never zero. */
export interface SeriesStatistics {
  readonly count: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly mean: number | null;
  /** Sample standard deviation (n - 1), so it needs at least two readings. */
  readonly standardDeviation: number | null;
  readonly outsideBandPercent: number | null;
}

/** Summarizes readings; `null` entries are absent or invalid readings and never count as zero. */
export function summarizeSeries(values: readonly (number | null)[], band: ThresholdBand | null): SeriesStatistics {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const count = valid.length;
  if (count === 0) {
    return { count: 0, min: null, max: null, mean: null, standardDeviation: null, outsideBandPercent: null };
  }
  const mean = valid.reduce((sum, value) => sum + value, 0) / count;
  const squares = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const outside = band ? valid.filter(value => value < band.min || value > band.max).length : 0;
  return {
    count,
    min: Math.min(...valid),
    max: Math.max(...valid),
    mean,
    standardDeviation: count > 1 ? Math.sqrt(squares / (count - 1)) : null,
    outsideBandPercent: band ? (outside / count) * 100 : null,
  };
}
