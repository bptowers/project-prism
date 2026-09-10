import { describe, it, expect } from 'vitest';
import { isDormant, isDark, isMisaligned } from './dealClassifiers';
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

describe('isDormant', () => {
  it('is true for 14 to 29 days stalled inclusive', () => {
    expect(isDormant(deal({ daysStalled: 13 }))).toBe(false);
    expect(isDormant(deal({ daysStalled: 14 }))).toBe(true);
    expect(isDormant(deal({ daysStalled: 29 }))).toBe(true);
    expect(isDormant(deal({ daysStalled: 30 }))).toBe(false);
  });
});

describe('isDark', () => {
  it('is true from 30 days stalled', () => {
    expect(isDark(deal({ daysStalled: 29 }))).toBe(false);
    expect(isDark(deal({ daysStalled: 30 }))).toBe(true);
    expect(isDark(deal({ daysStalled: 120 }))).toBe(true);
  });
});

describe('isMisaligned', () => {
  it('flags high stated confidence against a poor health score', () => {
    expect(isMisaligned(deal({ confidence: 80, healthScore: 30 }))).toBe(true);
  });

  it('requires both conditions', () => {
    expect(isMisaligned(deal({ confidence: 60, healthScore: 30 }))).toBe(false);
    expect(isMisaligned(deal({ confidence: 80, healthScore: 40 }))).toBe(false);
  });

  it('never flags a deal without a health score, even if it is HIGH risk', () => {
    expect(isMisaligned(deal({ confidence: 90, level: 'HIGH' }))).toBe(false);
  });
});
