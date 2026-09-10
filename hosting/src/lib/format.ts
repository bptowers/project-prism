/**
 * Shared display formatters. One implementation each so every widget renders
 * the same number the same way.
 */

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Render an ISO date or timestamp as an unambiguous "9 Jun 2026".
 *
 * A bare YYYY-MM-DD is treated as a calendar date (not UTC midnight, which
 * shifts a day west of Greenwich). A full timestamp is shown in local time.
 * Anything else — including model-authored prose like "End of week" — is
 * returned unchanged, and empty input yields ''.
 */
export function formatDate(input?: string): string {
  if (!input) return '';

  let date: Date | undefined;
  const calendar = CALENDAR_DATE.exec(input);
  if (calendar) {
    const [, y, m, d] = calendar;
    const candidate = new Date(Number(y), Number(m) - 1, Number(d));
    // Reject out-of-range parts (e.g. month 13) that Date would silently roll over.
    if (candidate.getFullYear() === Number(y) && candidate.getMonth() === Number(m) - 1 && candidate.getDate() === Number(d)) {
      date = candidate;
    }
  } else if (ISO_TIMESTAMP.test(input)) {
    const candidate = new Date(input);
    if (!Number.isNaN(candidate.getTime())) date = candidate;
  }

  if (!date) return input;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export const STAGE_ORDER = ['Discovery', 'Qualification', 'Solution', 'Proposal', 'Negotiation', 'Commit', 'Contract Review', 'Approved'];

const LATE_STAGES = new Set(['Proposal', 'Negotiation', 'Commit', 'Contract Review', 'Approved']);

/** Collapse Salesforce stage names onto the canonical funnel labels. */
export function normalizeStage(stage?: string): string {
  if (!stage) return 'Unknown';
  const lower = stage.toLowerCase();
  if (lower.includes('signature') || lower.includes('commit')) return 'Commit';
  if (lower.includes('contract')) return 'Contract Review';
  if (lower.includes('draft')) return 'Proposal';
  if (lower.includes('approved')) return 'Approved';
  const match = STAGE_ORDER.find(s => lower.includes(s.toLowerCase()));
  return match || stage;
}

export function isLateStage(stage?: string): boolean {
  return LATE_STAGES.has(normalizeStage(stage));
}
