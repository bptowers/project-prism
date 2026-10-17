import { describe, it, expect } from 'vitest';
import { filterQuestionByRegion, questionStat } from './croQuestions';

const q = {
  label: 'Gone silent', answer: 'Deals went quiet.',
  silent7Days: [
    { name: 'Acme', rep: 'Jo', region: 'UK', mrr: '$1K', stage: 'Proposal', daysSinceActivity: 9 },
    { name: 'Beta', rep: 'Sam', region: 'North America', mrr: '$2,500', stage: 'Commit', daysSinceActivity: 12 },
  ],
};

describe('filterQuestionByRegion', () => {
  it('keeps only rows in the region, matching LLM region names', () => {
    expect(filterQuestionByRegion(q, 'uk').silent7Days?.map(r => r.name)).toEqual(['Acme']);
    expect(filterQuestionByRegion(q, 'all')).toBe(q);
  });
});

describe('questionStat', () => {
  it('counts deal rows and sums their MRR', () => {
    expect(questionStat(q)).toEqual({ count: 2, text: '2 deals · $4K (AI figures)' });
  });

  it('leaves the AI label off when no row carries an MRR', () => {
    expect(questionStat({ label: 'x', answer: '', deals: [{ name: 'A', mrr: 'n/a' }] as never })).toEqual({ count: 1, text: '1 deal' });
  });

  it('describes region-only and empty questions', () => {
    expect(questionStat({ label: 'Coverage', answer: '', regions: [{ region: 'UK' }, { region: 'AU' }] })).toEqual({ count: 2, text: '2 regions' });
    expect(questionStat({ label: 'x', answer: '' })).toEqual({ count: 0, text: 'Nothing flagged' });
  });

  it('totals competitor threats, labelling the AI deal count and leaving it out when the AI did not give one', () => {
    const threat = (competitor: string, affectedDeals?: number) => ({ competitor, region: 'UK', affectedDeals, mrrAtRisk: '', displacementPattern: '' });
    expect(questionStat({ label: 'c', answer: '', threats: [threat('A', 2), threat('B', 3)] as never })).toEqual({ count: 2, text: '2 competitors · 5 deals (AI count)' });
    expect(questionStat({ label: 'c', answer: '', threats: [threat('A')] as never })).toEqual({ count: 1, text: '1 competitor' });
  });

  it('ignores prose and null entries where the AI should have written rows', () => {
    expect(questionStat({ label: 'x', answer: '', deals: 'None.' as never, reps: [null] as never })).toEqual({ count: 0, text: 'Nothing flagged' });
    expect(filterQuestionByRegion({ label: 'x', answer: '', deals: [null, { name: 'A', rep: '', region: 7, mrr: '' }] as never }, 'uk').deals).toEqual([]);
  });
});
