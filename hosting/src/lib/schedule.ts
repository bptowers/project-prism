// Next run of the scheduled BigQuery analysis. Mirrors the cron in
// functions/src/index.ts (runWeeklyAnalysis): '0 6 */3 * *' in UTC, i.e. 06:00
// on days-of-month 1, 4, 7 … 31. Manual runs can still happen in between.
// (Line comments on purpose: '*/' inside a block comment would end it.)
export function nextScheduledRun(from: Date): Date {
  const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 6));
  for (let i = 0; i < 40; i++) {
    if (candidate.getTime() > from.getTime() && (candidate.getUTCDate() - 1) % 3 === 0) return candidate;
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}
