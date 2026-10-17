import type { Region, TQDealRow, TQGapDeal, TQQuestion, TQRegionRow, TQRepRow, TQSilentDeal, TQThreatRow, TwentyQuestionsData } from './types';
import { asArray, isRecord, text } from './guards';
import { normalizeRegionKey } from './regions';
import { formatCurrency, parseMoney } from './format';
import { plural } from './takeaways';

export type QuestionKey = Exclude<keyof TwentyQuestionsData, 'generatedAt' | 'question10'>;

/** Questions 1–9 in display order. Question 10 (CRO interventions) has its own panel. */
export const CRO_QUESTIONS: { key: QuestionKey; label: string }[] = [
  { key: 'question1', label: 'Gone silent' },
  { key: 'question2', label: 'Slippage' },
  { key: 'question3', label: 'Coverage' },
  { key: 'question4', label: 'Rep risk' },
  { key: 'question5', label: 'No economic buyer' },
  { key: 'question6', label: 'Competitive' },
  { key: 'question7', label: 'Forecast fiction' },
  { key: 'question8', label: 'Risk by region' },
  { key: 'question9', label: 'Stage stalls' },
];

/** LLM rows: prose in place of an array is no rows, and a null or scalar entry is skipped. */
function rows<T>(value: unknown): T[] {
  return asArray<unknown>(value).filter(isRecord) as T[];
}

function keep<T extends { region?: string }>(value: unknown, region: Region): T[] {
  return rows<T>(value).filter(r => normalizeRegionKey(text(r.region)) === region);
}

/** Narrow every row array to one region. The AI's prose answer is left untouched (it is global). */
export function filterQuestionByRegion(q: TQQuestion, region: Region): TQQuestion {
  if (region === 'all') return q;
  return {
    ...q,
    silent7Days: keep<TQSilentDeal>(q.silent7Days, region),
    silent14Days: keep<TQSilentDeal>(q.silent14Days, region),
    silent30Days: keep<TQSilentDeal>(q.silent30Days, region),
    deals: keep<TQDealRow>(q.deals, region),
    regions: keep<TQRegionRow>(q.regions, region),
    reps: keep<TQRepRow>(q.reps, region),
    threats: keep<TQThreatRow>(q.threats, region),
    optimismBias: keep<TQGapDeal>(q.optimismBias, region),
    sandbagging: keep<TQGapDeal>(q.sandbagging, region),
  };
}

/**
 * A card's headline figure, counted from its rows (never read from the prose). The deal count is
 * code's; the money is the sum of the AI's per-row mrr, so a stat with money carries "(AI figures)".
 */
export function questionStat(q: TQQuestion): { count: number; text: string } {
  const dealRows = [
    ...rows<{ mrr?: string }>(q.silent7Days), ...rows<{ mrr?: string }>(q.silent14Days),
    ...rows<{ mrr?: string }>(q.silent30Days), ...rows<{ mrr?: string }>(q.deals),
    ...rows<{ mrr?: string }>(q.optimismBias), ...rows<{ mrr?: string }>(q.sandbagging),
  ];
  if (dealRows.length) {
    const value = dealRows.reduce((sum, r) => sum + parseMoney(r.mrr), 0);
    return { count: dealRows.length, text: `${plural(dealRows.length, 'deal')}${value > 0 ? ` · ${formatCurrency(value)} (AI figures)` : ''}` };
  }
  const reps = rows(q.reps);
  if (reps.length) return { count: reps.length, text: plural(reps.length, 'rep') };
  const threats = rows<TQThreatRow>(q.threats);
  if (threats.length) {
    const affected = threats.reduce((sum, t) => sum + (Number(t.affectedDeals) || 0), 0);
    // affectedDeals is the AI's own per-row count, so the total is labelled as such.
    return { count: threats.length, text: `${plural(threats.length, 'competitor')}${affected > 0 ? ` · ${plural(affected, 'deal')} (AI count)` : ''}` };
  }
  const regions = rows(q.regions);
  if (regions.length) return { count: regions.length, text: plural(regions.length, 'region') };
  return { count: 0, text: 'Nothing flagged' };
}
