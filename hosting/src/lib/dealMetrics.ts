import type { RiskDeal } from './types';
import { dimensionSignals, RISK_DIMENSION_LABELS } from './riskSignals';

/**
 * Deal scoring shared by every chart, takeaway and list. Extracted from
 * RiskRadar so the Overview, Deals tab and takeaways agree on one definition.
 */

export type RiskBand = 'Green' | 'Yellow' | 'Red';
export type RiskDimension = { label: string; value: number; pipeline: number };

export function riskScore(risk: RiskDeal): number {
  if (typeof risk.healthScore === 'number') return Math.max(0, Math.min(100, 100 - risk.healthScore));
  const stalledPressure = Math.min(18, Math.max(0, risk.daysStalled || 0) * 2);
  return risk.level === 'HIGH' ? 68 + stalledPressure : 36 + stalledPressure;
}

export function riskBand(risk: RiskDeal): RiskBand {
  if (typeof risk.healthScore === 'number') {
    if (risk.healthScore >= 70) return 'Green';
    if (risk.healthScore >= 40) return 'Yellow';
    return 'Red';
  }
  if (risk.level === 'HIGH') return 'Red';
  if (risk.level === 'MEDIUM') return 'Yellow';
  return 'Green';
}

export function dealValue(risk: RiskDeal): number {
  return Math.max(0, risk.pipelineValue || 0);
}

/** Value used for weighting: a deal with no value still counts once. */
export function weightedValue(risk: RiskDeal): number {
  const value = dealValue(risk);
  return value > 0 ? value : 1;
}

export function sumValue(risks: RiskDeal[]): number {
  return risks.reduce((sum, r) => sum + dealValue(r), 0);
}

export function isAtRisk(risk: RiskDeal): boolean {
  return risk.level === 'HIGH' || risk.level === 'MEDIUM';
}

/** Value-weighted health of the deals in view, 0–100. Computed in code, never by the LLM. */
export function revenueConfidence(risks: RiskDeal[]): number {
  const totalWeight = risks.reduce((sum, r) => sum + weightedValue(r), 0);
  if (!totalWeight) return 0;
  return Math.round(risks.reduce((sum, r) => sum + (100 - riskScore(r)) * weightedValue(r), 0) / totalWeight);
}

export function buildRiskDimensions(risks: RiskDeal[]): RiskDimension[] {
  const totals = RISK_DIMENSION_LABELS.reduce<Record<string, RiskDimension>>((acc, label) => {
    acc[label] = { label, value: 0, pipeline: 0 };
    return acc;
  }, {});

  for (const risk of risks) {
    const dimensions = dimensionSignals(risk);
    const pipeline = dealValue(risk);
    const severity = Math.max(0.25, riskScore(risk) / 100);
    const contribution = weightedValue(risk) * severity;
    for (const label of dimensions) {
      totals[label].value += contribution;
      totals[label].pipeline += pipeline / dimensions.length;
    }
  }

  const max = Math.max(...Object.values(totals).map(item => item.value), 1);
  return RISK_DIMENSION_LABELS.map(label => ({
    ...totals[label],
    value: Math.round((totals[label].value / max) * 100),
  }));
}
