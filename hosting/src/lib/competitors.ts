import type { Region } from './types';
import { asArray, isRecord, text } from './guards';
import { parseMoney } from './format';
import { normalizeRegionKey, regionLabel } from './regions';

export interface CompetitorCard {
  name: string;
  deals: number;
  value: number;
  regions: string[];
  howTheyWin?: string;
  counter?: string;
}

/**
 * One card per competitor, from CRO question 6 threats (active pipeline) and
 * competitive-displacement loss mechanisms. Deal counts and values are summed
 * here, not taken from prose. Both inputs are unvalidated LLM JSON, so rows are
 * dropped or coerced rather than trusted.
 */
/** A competitor name: only a non-blank string counts (a stray number is not a competitor). */
const nameOf = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function buildCompetitorCards(threatsRaw: unknown, lossesRaw: unknown, region: Region): CompetitorCard[] {
  const inView = (r: unknown) => region === 'all' || normalizeRegionKey(String(r ?? '')) === region;
  const cards = new Map<string, CompetitorCard>();
  const cardFor = (name: string) => {
    const key = name.toLowerCase();
    if (!cards.has(key)) cards.set(key, { name, deals: 0, value: 0, regions: [] });
    return cards.get(key)!;
  };
  const addRegion = (card: CompetitorCard, r: unknown) => {
    if (typeof r !== 'string' || !r.trim()) return;
    const label = regionLabel(r);
    if (!card.regions.includes(label)) card.regions.push(label);
  };

  for (const t of asArray<unknown>(threatsRaw).filter(isRecord)) {
    const name = nameOf(t.competitor);
    if (!name || !inView(t.region)) continue;
    const card = cardFor(name);
    const deals = Number(t.affectedDeals);
    if (Number.isFinite(deals) && deals > 0) card.deals += Math.round(deals);
    card.value += parseMoney(text(t.mrrAtRisk));
    addRegion(card, t.region);
    if (!card.howTheyWin && text(t.displacementPattern)) card.howTheyWin = text(t.displacementPattern);
  }
  for (const l of asArray<unknown>(lossesRaw).filter(isRecord)) {
    const name = nameOf(l.competitor);
    if (!name || !inView(l.region)) continue;
    const card = cardFor(name);
    addRegion(card, l.region);
    if (!card.howTheyWin && text(l.realMechanism)) card.howTheyWin = text(l.realMechanism);
    if (!card.counter && text(l.counter)) card.counter = text(l.counter);
  }
  return [...cards.values()].sort((a, b) => b.value - a.value || b.deals - a.deals || a.name.localeCompare(b.name));
}
