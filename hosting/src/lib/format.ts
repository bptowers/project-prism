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

/**
 * A deal total for display. pipelineValue is often missing, so a $0 total over
 * real deals means "no value recorded" and shows a dash rather than a misleading $0.
 */
export function formatValue(value: number, count: number): string {
  if (value > 0) return formatCurrency(value);
  return count > 0 ? '—' : '$0';
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
  // Trimmed once, so a stage with stray whitespace matches itself after a round trip through the URL hash.
  const s = stage?.trim();
  if (!s) return 'Unknown';
  const lower = s.toLowerCase();
  if (lower.includes('signature') || lower.includes('commit')) return 'Commit';
  if (lower.includes('contract')) return 'Contract Review';
  if (lower.includes('draft')) return 'Proposal';
  if (lower.includes('approved')) return 'Approved';
  const match = STAGE_ORDER.find(name => lower.includes(name.toLowerCase()));
  return match || s;
}

export function isLateStage(stage?: string): boolean {
  return LATE_STAGES.has(normalizeStage(stage));
}

// The suffix must not run into a word, so "$12,000 MRR" is 12,000, not 12,000 × 1M.
const MONEY = /(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)\s*(?:([kKmMbB])(?![a-zA-Z]))?/;
const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/**
 * Parse an LLM-authored money string ("$12,400", "$1.2M", "£40K MRR") to a
 * number. Anything unparseable is 0 so a takeaway never shows NaN.
 */
export function parseMoney(input?: string | number): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const match = MONEY.exec(input);
  if (!match) return 0;
  const n = Number(match[1].replace(/,/g, ''));
  const mult = MULTIPLIER[(match[2] ?? '').toLowerCase()] ?? 1;
  return Number.isFinite(n) ? n * mult : 0;
}
