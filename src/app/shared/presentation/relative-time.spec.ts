import { relativeTime } from './relative-time';

describe('relativeTime', () => {
  const now = new Date('2026-11-11T12:00:00Z');

  it('describes the largest whole unit that fits, in the given language', () => {
    expect(relativeTime(new Date('2026-11-11T09:00:00Z'), now, 'en-US')).toBe('3 hours ago');
    expect(relativeTime(new Date('2026-11-11T11:45:00Z'), now, 'en-US')).toBe('15 minutes ago');
    expect(relativeTime(new Date('2026-11-09T12:00:00Z'), now, 'en-US')).toBe('2 days ago');
    expect(relativeTime(new Date('2026-11-11T09:00:00Z'), now, 'es-419')).toBe('hace 3 horas');
  });

  it('reads a moment less than a minute away as the current minute', () => {
    expect(relativeTime(new Date('2026-11-11T11:59:30Z'), now, 'en-US')).toBe('this minute');
  });
});
