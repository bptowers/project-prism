import type { RiskDeal } from './types';
import { isLateStage } from './format';

/** Ordered dimension labels used by the risk radar and driver ranking. */
export const RISK_DIMENSION_LABELS = ['Engagement', 'Velocity', 'Forecast', 'Stakeholders', 'Competition', 'Commercial', 'Process', 'Late Stage'];

/**
 * Derive named risk dimensions from a deal's narrative summary and action.
 * Single source of truth — the radar and the deal detail modal must agree.
 */
export function dimensionSignals(risk: RiskDeal): string[] {
  const lower = `${risk.summary} ${risk.action}`.toLowerCase();
  const signals: string[] = [];

  if (lower.includes('ghost') || lower.includes('dark') || lower.includes('activity') || lower.includes('engagement') || lower.includes('no response')) {
    signals.push('Engagement');
  }
  if (lower.includes('stalled') || lower.includes('stage') || lower.includes('velocity') || lower.includes('close date') || risk.daysStalled >= 4) {
    signals.push('Velocity');
  }
  if (lower.includes('forecast') || lower.includes('probability') || lower.includes('commit') || lower.includes('fiction')) {
    signals.push('Forecast');
  }
  if (lower.includes('stakeholder') || lower.includes('champion') || lower.includes('economic buyer') || lower.includes('committee') || lower.includes('single')) {
    signals.push('Stakeholders');
  }
  if (lower.includes('competitor') || lower.includes('competitive') || lower.includes('fud') || lower.includes('poc')) {
    signals.push('Competition');
  }
  if (lower.includes('pricing') || lower.includes('budget') || lower.includes('cost') || lower.includes('commercial')) {
    signals.push('Commercial');
  }
  if (lower.includes('qualification') || lower.includes('missing') || lower.includes('no next') || lower.includes('hygiene') || lower.includes('review')) {
    signals.push('Process');
  }
  if (isLateStage(risk.stage)) {
    signals.push('Late Stage');
  }

  return signals.length ? signals : ['Process'];
}
