import { describe, it, expect } from 'vitest';
import { nextScheduledRun } from './schedule';

// runWeeklyAnalysis cron: '0 6 */3 * *' (UTC) runs on days 1, 4, 7 … 31 at 06:00.
describe('nextScheduledRun', () => {
  it.each([
    ['2026-10-14T07:00:00Z', '2026-10-16T06:00:00.000Z'],
    ['2026-10-13T05:00:00Z', '2026-10-13T06:00:00.000Z'],
    ['2026-10-13T06:00:00Z', '2026-10-16T06:00:00.000Z'],
    ['2026-10-31T07:00:00Z', '2026-11-01T06:00:00.000Z'],
    // */3 restarts each month, so month ends break the 3-day rhythm.
    ['2026-10-30T07:00:00Z', '2026-10-31T06:00:00.000Z'],
    ['2026-09-28T07:00:00Z', '2026-10-01T06:00:00.000Z'],
    ['2026-02-28T07:00:00Z', '2026-03-01T06:00:00.000Z'],
    ['2028-02-28T07:00:00Z', '2028-03-01T06:00:00.000Z'],
    ['2026-12-31T07:00:00Z', '2027-01-01T06:00:00.000Z'],
  ])('after %s is %s', (from, expected) => {
    expect(nextScheduledRun(new Date(from)).toISOString()).toBe(expected);
  });
});
