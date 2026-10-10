import { describe, it, expect } from 'vitest';
import { dimensionSignals, RISK_DIMENSION_LABELS } from './riskSignals';
import type { RiskDeal } from './types';

function deal(overrides: Partial<RiskDeal>): RiskDeal {
  return {
    id: 1,
    region: 'uk',
    level: 'MEDIUM',
    value: 'Acme',
    confidence: 50,
    summary: '',
    action: '',
    daysStalled: 0,
    ...overrides,
  };
}

describe('dimensionSignals', () => {
  it('classifies narrative text into named risk dimensions', () => {
    const signals = dimensionSignals(deal({
      summary: 'Champion has gone dark; competitor running a POC.',
      action: 'Re-engage the economic buyer.',
    }));
    expect(signals).toContain('Engagement');
    expect(signals).toContain('Stakeholders');
    expect(signals).toContain('Competition');
  });

  it('flags Velocity from days stalled even without matching text', () => {
    expect(dimensionSignals(deal({ daysStalled: 10 }))).toContain('Velocity');
  });

  it('appends Late Stage for deals in Proposal or later', () => {
    expect(dimensionSignals(deal({ stage: 'Negotiation' }))).toContain('Late Stage');
    expect(dimensionSignals(deal({ stage: 'Discovery' }))).not.toContain('Late Stage');
  });

  it('falls back to Process when nothing else matches', () => {
    expect(dimensionSignals(deal({}))).toEqual(['Process']);
  });

  it('exposes the ordered label list used by the radar', () => {
    expect(RISK_DIMENSION_LABELS).toEqual(['Engagement', 'Velocity', 'Forecast', 'Stakeholders', 'Competition', 'Commercial', 'Process', 'Late Stage']);
  });
});
