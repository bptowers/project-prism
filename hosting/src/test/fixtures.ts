import type { RegionData, RiskDeal, StatData } from '@/lib/types';

let nextId = 1;

/** A plausible deal; override only what the test cares about. */
export function makeDeal(overrides: Partial<RiskDeal> = {}): RiskDeal {
  const id = nextId++;
  return {
    id,
    opportunityId: `OPP-${id}`,
    value: `Deal ${id}`,
    region: 'uk',
    level: 'MEDIUM',
    confidence: 50,
    summary: '',
    action: '',
    daysStalled: 0,
    stage: 'Proposal',
    rep: 'Jo',
    pipelineValue: 10_000,
    healthScore: 50,
    ...overrides,
  };
}

const stat = (value = '—'): StatData => ({ value, change: '—', dir: 'flat', sub: '' });

export function makeRegionData(risks: RiskDeal[], overrides: Partial<RegionData> = {}): RegionData {
  return {
    stats: { pipeline: stat(), atRisk: stat(), velocity: stat(), forecast: stat('70%') },
    sparklines: {},
    funnel: [],
    winThemes: [],
    lossThemes: [],
    risks,
    signals: [],
    competitors: [],
    recommendations: [],
    trendData: { weeks: [], all: [], na: [], uk: [], au: [] },
    ...overrides,
  };
}
