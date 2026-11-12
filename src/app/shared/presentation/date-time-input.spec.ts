import { combineDayAndTime, defaultTime } from './date-time-input';

describe('combineDayAndTime', () => {
  it('joins a picked local day with a time field value', () => {
    const combined = combineDayAndTime(new Date(2026, 10, 11), '08:45');

    expect(combined?.getFullYear()).toBe(2026);
    expect(combined?.getMonth()).toBe(10);
    expect(combined?.getDate()).toBe(11);
    expect(combined?.getHours()).toBe(8);
    expect(combined?.getMinutes()).toBe(45);
  });

  it('stays empty until both parts are set and a valid time is entered', () => {
    expect(combineDayAndTime(null, '08:45')).toBeNull();
    expect(combineDayAndTime(new Date(2026, 10, 11), null)).toBeNull();
    expect(combineDayAndTime(new Date(2026, 10, 11), '25:00')).toBeNull();
  });
});

describe('defaultTime', () => {
  it('formats the current local time as HH:mm', () => {
    expect(defaultTime()).toMatch(/^\d{2}:\d{2}$/);
  });
});
