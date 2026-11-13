import { mapWithConcurrency } from './map-with-concurrency';

describe('mapWithConcurrency', () => {
  it('keeps the input order even when later items finish first', async () => {
    const result = await mapWithConcurrency([30, 10, 20], 2, async delay => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return delay;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it('never runs more calls at once than the limit', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, index) => index), 4, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
    });

    expect(peak).toBe(4);
  });

  it('returns no results for no items', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
