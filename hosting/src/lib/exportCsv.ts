import type { RiskDeal } from './types';
import { normalizeStage } from './format';
import { regionLabel } from './regions';

const HEADERS = ['Account Name', 'Opportunity Name', 'Region', 'Stage', 'Rep', 'Risk Level', 'Health Score', 'Pipeline Value', 'Days Stalled', 'Confidence', 'Summary', 'Recommended Action'];

/** Characters that make Excel or Sheets read a cell as a formula (CSV injection). */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Quote a free-text cell. Embedded quotes are doubled so commas, quotes and
 * newlines survive, and a leading formula trigger gets an apostrophe so a deal
 * name like "=HYPERLINK(...)" opens as text rather than running.
 */
function cell(v: string): string {
  const safe = FORMULA_TRIGGER.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Every free-text field is quoted (the old exporter left names unquoted, so a comma split the row). */
export function dealsToCsv(risks: RiskDeal[]): string {
  const rows = risks.map(r => [
    cell(r.accountName ?? ''),
    cell(r.value),
    cell(regionLabel(r.region)),
    cell(normalizeStage(r.stage)),
    cell(r.rep ?? 'Unassigned'),
    r.level,
    r.healthScore ?? '',
    r.pipelineValue ?? 0,
    r.daysStalled,
    r.confidence,
    cell(r.summary ?? ''),
    cell(r.action ?? ''),
  ].join(','));
  return [HEADERS.join(','), ...rows].join('\n');
}

export function downloadDealsCsv(risks: RiskDeal[], today: Date = new Date()): void {
  const blob = new Blob([dealsToCsv(risks)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prism-deals-${today.toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
