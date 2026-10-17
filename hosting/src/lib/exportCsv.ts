import type { RiskDeal } from './types';
import { normalizeStage } from './format';
import { regionLabel } from './regions';

const HEADERS = ['Account Name', 'Opportunity Name', 'Region', 'Stage', 'Rep', 'Risk Level', 'Health Score', 'Pipeline Value', 'Days Stalled', 'Confidence', 'Summary', 'Recommended Action'];

/** Characters that make Excel or Sheets read a cell as a formula (CSV injection), even after leading spaces. */
const FORMULA_TRIGGER = /^\s*[=+\-@\t\r]/;

/**
 * Quote a free-text cell. Embedded quotes are doubled so commas, quotes and
 * newlines survive, and a leading formula trigger gets an apostrophe so a deal
 * name like "=HYPERLINK(...)" opens as text rather than running.
 */
function cell(v: string): string {
  const safe = FORMULA_TRIGGER.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * A finite number is written bare; NaN or Infinity is an empty cell, not the text "NaN".
 * Anything else that turns up in a numeric column goes through cell().
 */
function num(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : cell('');
  return cell(String(v ?? ''));
}

/** Every free-text field is quoted (the old exporter left names unquoted, so a comma split the row). */
export function dealsToCsv(risks: RiskDeal[]): string {
  const rows = risks.map(r => [
    cell(r.accountName ?? ''),
    cell(r.value),
    cell(regionLabel(r.region)),
    cell(normalizeStage(r.stage)),
    cell(r.rep ?? 'Unassigned'),
    cell(r.level),
    num(r.healthScore),
    num(r.pipelineValue ?? 0),
    num(r.daysStalled),
    num(r.confidence),
    cell(r.summary ?? ''),
    cell(r.action ?? ''),
  ].join(','));
  // CRLF row ends are what RFC 4180 and Excel expect.
  return [HEADERS.join(','), ...rows].join('\r\n');
}

export function downloadDealsCsv(risks: RiskDeal[], today: Date = new Date()): void {
  // The BOM tells Excel the file is UTF-8, so names like "Zoë" don't open as mojibake.
  const blob = new Blob(['\uFEFF', dealsToCsv(risks)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prism-deals-${today.toISOString().split('T')[0]}.csv`;
  // Firefox ignores click() on a detached link; revoking in the same tick can cancel the download.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
