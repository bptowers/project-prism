import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import { riskScore, riskBand, bandForRisk, revenueConfidence, sumValue, isAtRisk, buildRiskDimensions } from './dealMetrics';

describe('riskScore', () => {
  it('is 100 minus the health score when one exists', () => {
    expect(riskScore(makeDeal({ healthScore: 30 }))).toBe(70);
  });

  it('falls back to level plus stall pressure without a health score', () => {
    expect(riskScore(makeDeal({ healthScore: undefined, level: 'HIGH', daysStalled: 3 }))).toBe(74);
    expect(riskScore(makeDeal({ healthScore: undefined, level: 'MEDIUM', daysStalled: 20 }))).toBe(54);
  });

  it('ignores a non-finite health score and falls back to the level', () => {
    expect(riskScore(makeDeal({ healthScore: NaN, level: 'HIGH', daysStalled: 0 }))).toBe(68);
    expect(riskScore(makeDeal({ healthScore: Infinity, level: 'MEDIUM', daysStalled: 0 }))).toBe(36);
  });
});

describe('riskBand', () => {
  it('bands by health score', () => {
    expect(riskBand(makeDeal({ healthScore: 70 }))).toBe('Green');
    expect(riskBand(makeDeal({ healthScore: 40 }))).toBe('Yellow');
    expect(riskBand(makeDeal({ healthScore: 39 }))).toBe('Red');
  });

  it('bands by level without a health score', () => {
    expect(riskBand(makeDeal({ healthScore: undefined, level: 'HIGH' }))).toBe('Red');
  });

  it('ignores a non-finite health score and bands by level', () => {
    expect(riskBand(makeDeal({ healthScore: NaN, level: 'HIGH' }))).toBe('Red');
    expect(riskBand(makeDeal({ healthScore: -Infinity, level: 'MEDIUM' }))).toBe('Yellow');
  });
});

describe('bandForRisk', () => {
  it('uses the same thresholds as riskBand (risk = 100 - health)', () => {
    expect(bandForRisk(30)).toBe('Green');
    expect(bandForRisk(31)).toBe('Yellow');
    expect(bandForRisk(60)).toBe('Yellow');
    expect(bandForRisk(61)).toBe('Red');
    for (const health of [0, 39, 40, 69, 70, 100]) {
      expect(bandForRisk(100 - health)).toBe(riskBand(makeDeal({ healthScore: health })));
    }
  });
});

describe('revenueConfidence', () => {
  it('is the value-weighted average of (100 - risk)', () => {
    const deals = [
      makeDeal({ healthScore: 80, pipelineValue: 30_000 }),
      makeDeal({ healthScore: 20, pipelineValue: 10_000 }),
    ];
    expect(revenueConfidence(deals)).toBe(65);
  });

  it('is 0 with no deals', () => {
    expect(revenueConfidence([])).toBe(0);
  });
});

describe('sumValue / isAtRisk', () => {
  it('sums pipeline value, ignoring negatives and missing values', () => {
    expect(sumValue([makeDeal({ pipelineValue: 5_000 }), makeDeal({ pipelineValue: undefined }), makeDeal({ pipelineValue: -10 })])).toBe(5_000);
  });

  it('treats HIGH and MEDIUM as at risk', () => {
    expect(isAtRisk(makeDeal({ level: 'HIGH' }))).toBe(true);
    expect(isAtRisk(makeDeal({ level: 'MEDIUM' }))).toBe(true);
    expect(isAtRisk(makeDeal({ level: 'LOW' }))).toBe(false);
  });
});

describe('buildRiskDimensions', () => {
  it('returns every dimension label, normalised so the top driver is 100', () => {
    const dims = buildRiskDimensions([makeDeal({ summary: 'Champion has gone dark', daysStalled: 10 })]);
    expect(dims.map(d => d.label)).toContain('Stakeholders');
    expect(Math.max(...dims.map(d => d.value))).toBe(100);
  });
});
