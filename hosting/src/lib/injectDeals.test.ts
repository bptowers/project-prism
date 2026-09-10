import { describe, it, expect } from 'vitest';
import { injectDeals, countDealsByRegion } from './injectDeals';
import type { RegionData, ReportDocument, RiskDeal } from './types';

function deal(id: number, region: string | undefined): RiskDeal {
  return {
    id,
    region: region as string,
    level: 'MEDIUM',
    value: `Deal ${id}`,
    confidence: 50,
    summary: '',
    action: '',
    daysStalled: 0,
  };
}

function slice(risks: RiskDeal[] = []): RegionData {
  return {
    stats: {
      pipeline: { value: '', change: '', dir: 'flat', sub: '' },
      atRisk: { value: '', change: '', dir: 'flat', sub: '' },
      velocity: { value: '', change: '', dir: 'flat', sub: '' },
      forecast: { value: '', change: '', dir: 'flat', sub: '' },
    },
    sparklines: {},
    funnel: [],
    winThemes: [],
    lossThemes: [],
    risks,
    signals: [],
    competitors: [],
    recommendations: [],
    trendData: { weeks: [], all: [], na: [], uk: [], au: [] },
  };
}

function report(transformed?: Record<string, RegionData>): ReportDocument {
  return {
    id: '2026-09-10',
    reportDate: '2026-09-10',
    createdAt: new Date('2026-09-10T06:00:00Z'),
    analysisProvider: 'claude',
    totalRecordsAnalyzed: 3,
    transformed,
  };
}

describe('injectDeals', () => {
  it('joins legacy region names onto the normalised regional slices', () => {
    const base = report({ all: slice([deal(99, 'na')]), na: slice(), uk: slice(), au: slice() });
    const deals = [deal(1, 'NAMER'), deal(2, 'UK'), deal(3, 'ANZ'), deal(4, 'North America')];

    const result = injectDeals(base, deals);

    expect(result.transformed!.na.risks.map(d => d.id)).toEqual([1, 4]);
    expect(result.transformed!.uk.risks.map(d => d.id)).toEqual([2]);
    expect(result.transformed!.au.risks.map(d => d.id)).toEqual([3]);
  });

  it('replaces the all slice with every fetched deal', () => {
    const base = report({ all: slice([deal(99, 'na')]), na: slice() });
    const result = injectDeals(base, [deal(1, 'na'), deal(2, 'uk')]);
    expect(result.transformed!.all.risks.map(d => d.id)).toEqual([1, 2]);
  });

  it('rewrites each injected deal region to the normalised key', () => {
    const base = report({ all: slice(), na: slice() });
    const result = injectDeals(base, [deal(1, 'NAMER'), deal(2, undefined)]);
    expect(result.transformed!.all.risks.map(d => d.region)).toEqual(['na', 'unknown']);
    expect(result.transformed!.na.risks[0].region).toBe('na');
  });

  it('ignores deals whose region has no slice in the report instead of throwing', () => {
    const base = report({ all: slice(), na: slice() });
    const result = injectDeals(base, [deal(1, 'LATAM')]);
    expect(result.transformed!.all.risks).toHaveLength(1);
    expect(result.transformed!.na.risks).toHaveLength(0);
    expect(result.transformed!.latam).toBeUndefined();
  });

  it('leaves the embedded risks alone when there are no deals or no transformed payload', () => {
    const withEmbedded = report({ all: slice([deal(99, 'na')]) });
    expect(injectDeals(withEmbedded, []).transformed!.all.risks.map(d => d.id)).toEqual([99]);
    const bare = report(undefined);
    expect(injectDeals(bare, [deal(1, 'na')]).transformed).toBeUndefined();
  });

  it('does not mutate the input report', () => {
    const base = report({ all: slice(), na: slice() });
    injectDeals(base, [deal(1, 'na')]);
    expect(base.transformed!.all.risks).toHaveLength(0);
    expect(base.transformed!.na.risks).toHaveLength(0);
  });
});

describe('countDealsByRegion', () => {
  it('counts deals per normalised key', () => {
    const counts = countDealsByRegion([deal(1, 'NAMER'), deal(2, 'na'), deal(3, 'UK'), deal(4, 'Unknown')]);
    expect(counts).toEqual({ na: 2, uk: 1, unknown: 1 });
  });
});
