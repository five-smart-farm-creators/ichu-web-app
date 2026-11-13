import type { Chart } from 'chart.js';

/** Chart.js is large, so it loads on the first chart; every chart shares this one import and therefore one lazy chunk. */
export async function loadChartJs(): Promise<typeof Chart> {
  const { default: ChartConstructor } = await import('chart.js/auto');
  return ChartConstructor;
}

/** Canvas drawing takes literal colors, so design tokens are read from the document when the chart is drawn. */
export function cssColor(color: string): string {
  if (!color.startsWith('--')) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(color).trim() || '#2E5B43';
}
