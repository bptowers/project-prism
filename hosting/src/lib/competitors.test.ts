import { describe, it, expect } from 'vitest';
import { buildCompetitorCards } from './competitors';

const threats = [
  { competitor: 'JobLogic', region: 'UK', affectedDeals: 3, mrrAtRisk: '$12K', displacementPattern: 'Undercuts on price' },
  { competitor: 'joblogic ', region: 'North America', affectedDeals: 1, mrrAtRisk: '$2K', displacementPattern: 'x' },
  { competitor: 'ServiceM8', region: 'AU', affectedDeals: 5, mrrAtRisk: '$4K', displacementPattern: 'Mobile-first' },
];
const losses = [{ region: 'UK', competitor: 'JobLogic', statedReason: 'Price', realMechanism: 'Bundled scheduling', counter: 'Lead with 3-year cost' }];

describe('buildCompetitorCards', () => {
  it('groups by competitor case-insensitively and sorts by value at risk', () => {
    const cards = buildCompetitorCards(threats, losses, 'all');
    expect(cards.map(c => c.name)).toEqual(['JobLogic', 'ServiceM8']);
    expect(cards[0]).toMatchObject({ deals: 4, value: 14_000, regions: ['UK', 'North America'], howTheyWin: 'Undercuts on price', counter: 'Lead with 3-year cost' });
  });

  it('filters to a region and tolerates prose in array slots', () => {
    expect(buildCompetitorCards(threats, 'Not available in source data.', 'au').map(c => c.name)).toEqual(['ServiceM8']);
  });

  it('skips malformed rows instead of throwing', () => {
    const malformed = [
      'None',
      null,
      { competitor: 42, region: 'UK', affectedDeals: 2, mrrAtRisk: '$1K' },
      { competitor: '   ', region: 'UK', affectedDeals: 2, mrrAtRisk: '$1K' },
      { competitor: 'Fergus', region: 7, affectedDeals: 'lots', mrrAtRisk: { v: 1 }, displacementPattern: { x: 1 } },
      { competitor: 'Tradify', region: 'UK', affectedDeals: -3, mrrAtRisk: '$3K' },
    ];
    const cards = buildCompetitorCards(malformed, [{ competitor: 'Fergus', counter: ['x'] }], 'all');
    expect(cards.map(c => c.name)).toEqual(['Tradify', 'Fergus']);
    expect(cards[0]).toMatchObject({ deals: 0, value: 3_000, regions: ['UK'] });
    expect(cards[1]).toMatchObject({ deals: 0, value: 0, regions: [] });
    expect(cards[1].howTheyWin).toBeUndefined();
    expect(cards[1].counter).toBeUndefined();
    expect(buildCompetitorCards(malformed, undefined, 'uk').map(c => c.name)).toEqual(['Tradify']);
  });

  it('keeps loss-only competitors with no open deals, after the active threats', () => {
    const cards = buildCompetitorCards([], [{ region: 'UK', competitor: 'Aroflo', realMechanism: 'Cheaper', counter: 'ROI' }], 'uk');
    expect(cards).toEqual([{ name: 'Aroflo', deals: 0, value: 0, regions: ['UK'], howTheyWin: 'Cheaper', counter: 'ROI' }]);
  });

  it('breaks ties by name so the order never depends on the LLM', () => {
    const tied = [
      { competitor: 'Zeta', region: 'UK', affectedDeals: 1, mrrAtRisk: '$1K' },
      { competitor: 'Alpha', region: 'UK', affectedDeals: 1, mrrAtRisk: '$1K' },
    ];
    expect(buildCompetitorCards(tied, [], 'all').map(c => c.name)).toEqual(['Alpha', 'Zeta']);
  });
});
