const DAY_MILLISECONDS = 86_400_000;

/** New cases of one day; days between the first and the last case are kept at zero so the curve has no gaps. */
export interface DailyCases {
  readonly day: string;
  readonly cases: number;
}

/** Expands the API's sparse day counts into consecutive days, from the first case day to the last. */
export function dailyCases(newCasesByDay: Readonly<Record<string, number>>): DailyCases[] {
  const days = Object.keys(newCasesByDay).sort();
  if (days.length === 0) return [];
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);
  const series: DailyCases[] = [];
  for (let time = Date.parse(`${days[0]}T00:00:00Z`); time <= last; time += DAY_MILLISECONDS) {
    const day = new Date(time).toISOString().slice(0, 10);
    series.push({ day, cases: newCasesByDay[day] ?? 0 });
  }
  return series;
}

/** Running total of cases, one value per day of the series. */
export function cumulativeCases(series: readonly DailyCases[]): number[] {
  const running: number[] = [];
  let total = 0;
  for (const { cases } of series) {
    total += cases;
    running.push(total);
  }
  return running;
}

/** Trailing mean over `window` days; the first days without a full window stay null rather than showing a partial mean. */
export function movingAverage(values: readonly number[], window: number): (number | null)[] {
  return values.map((_, index) => {
    if (index + 1 < window) return null;
    const total = values.slice(index + 1 - window, index + 1).reduce((sum, value) => sum + value, 0);
    return total / window;
  });
}

/** The day with the most cases; the earliest day wins a tie, and a period without cases has no peak. */
export function peakDay(series: readonly DailyCases[]): DailyCases | null {
  let peak: DailyCases | null = null;
  for (const day of series) {
    if (day.cases > 0 && (peak === null || day.cases > peak.cases)) peak = day;
  }
  return peak;
}

export function totalCases(series: readonly DailyCases[]): number {
  return series.reduce((sum, day) => sum + day.cases, 0);
}

/** Cases as a percentage of the herd; without a herd size the rate is unknown, never zero. */
export function attackRatePercent(cases: number, herdSize: number | null): number | null {
  return herdSize !== null && herdSize > 0 ? (cases / herdSize) * 100 : null;
}
