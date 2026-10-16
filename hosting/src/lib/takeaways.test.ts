import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import {
  riskMapTakeaway, driversTakeaway, regionTakeaway, queueTakeaway, stageTakeaway,
  activityTakeaway, forecastTakeaway, funnelTakeaway, repTakeaway, interventionsTakeaway,
  changeTakeaway, competitorTakeaway,
} from './takeaways';

describe('riskMapTakeaway', () => {
  it('states the HIGH-risk share of at-risk value', () => {
    const deals = [
      makeDeal({ level: 'HIGH', pipelineValue: 30_000 }),
      makeDeal({ level: 'MEDIUM', pipelineValue: 10_000 }),
      makeDeal({ level: 'LOW', pipelineValue: 50_000 }),
    ];
    expect(riskMapTakeaway(deals)).toBe('1 HIGH-risk deal holds 75% of the $40K at risk.');
  });

  it('handles no risk', () => {
    expect(riskMapTakeaway([makeDeal({ level: 'LOW' })])).toBe('No deals are flagged at risk in this view.');
  });
});

describe('driversTakeaway', () => {
  it('names the top two drivers', () => {
    const dims = [
      { label: 'Engagement', value: 100, pipeline: 0 },
      { label: 'Stakeholders', value: 80, pipeline: 0 },
      { label: 'Process', value: 10, pipeline: 0 },
    ];
    expect(driversTakeaway(62, dims)).toBe('Revenue confidence is 62/100. Engagement is the biggest risk driver, then stakeholders.');
  });

  it('copes with no drivers', () => {
    expect(driversTakeaway(90, [{ label: 'Process', value: 0, pipeline: 0 }])).toBe('Revenue confidence is 90/100. No single risk driver stands out.');
  });
});

describe('regionTakeaway', () => {
  it('names the lowest-confidence region that has deals', () => {
    expect(regionTakeaway([
      { label: 'North America', confidence: 60, dealCount: 5 },
      { label: 'UK', confidence: 41, dealCount: 3 },
      { label: 'AU / NZ', confidence: 10, dealCount: 0 },
    ])).toBe('UK has the lowest revenue confidence (41/100).');
  });
});

describe('queueTakeaway', () => {
  const q = [makeDeal({ value: 'A', pipelineValue: 20_000 }), makeDeal({ value: 'B', pipelineValue: 5_000 })];

  it('counts what is still to review', () => {
    expect(queueTakeaway(q, d => d.value === 'A')).toBe('1 deal worth $5K still needs a look.');
  });

  it('celebrates an empty queue and handles none', () => {
    expect(queueTakeaway(q, () => true)).toBe('All done: every deal in this queue has been reviewed.');
    expect(queueTakeaway([], () => false)).toBe('No late-stage deals in this view.');
  });
});

describe('panel takeaways', () => {
  it('stageTakeaway names the stage holding the most HIGH-risk value', () => {
    const deals = [
      makeDeal({ level: 'HIGH', stage: 'Commit', pipelineValue: 40_000 }),
      makeDeal({ level: 'HIGH', stage: 'Proposal', pipelineValue: 5_000 }),
    ];
    expect(stageTakeaway(deals)).toBe('Commit holds 1 HIGH-risk deal worth $40K.');
  });

  it('activityTakeaway counts deals quiet for 14+ days', () => {
    expect(activityTakeaway([makeDeal({ daysStalled: 20, pipelineValue: 8_000 }), makeDeal({ daysStalled: 2 })]))
      .toBe('1 deal worth $8K has had no activity for 14+ days.');
  });

  it('forecastTakeaway uses the shared misalignment rule', () => {
    expect(forecastTakeaway([makeDeal({ confidence: 85, healthScore: 20, pipelineValue: 12_000 })]))
      .toBe('1 deal worth $12K looks stronger in the forecast than its health suggests.');
    expect(forecastTakeaway([makeDeal({ confidence: 50, healthScore: 70 })]))
      .toBe('Rep confidence and deal health line up across this view.');
  });

  it('funnelTakeaway compares early and later stages', () => {
    expect(funnelTakeaway([
      { stage: 'Discovery', count: 2, revenue: '', color: '' },
      { stage: 'Commit', count: 9, revenue: '', color: '' },
    ])).toBe('2 deals in early stages and 9 in later stages. Early pipeline looks thin for next quarter.');
  });

  it('repTakeaway names the lowest-confidence rep', () => {
    const deals = [
      makeDeal({ rep: 'Jo', healthScore: 20, level: 'HIGH', pipelineValue: 30_000 }),
      makeDeal({ rep: 'Sam', healthScore: 90, level: 'LOW' }),
    ];
    expect(repTakeaway(deals)).toBe('Jo has the lowest revenue confidence (20/100) with $30K at risk.');
  });

  it('interventionsTakeaway sums MRR from LLM rows', () => {
    expect(interventionsTakeaway([{ mrr: '$12,000' }, { mrr: '$3K' }])).toBe('2 deals worth $15K need you personally.');
    expect(interventionsTakeaway([])).toBe('Nothing in this view needs CRO intervention.');
  });

  it('changeTakeaway leads with the biggest concern', () => {
    const d = (deal: string) => ({ deal, rep: 'Jo', region: 'UK', change: 'x' });
    expect(changeTakeaway([d('Acme'), d('Beta')], [d('Gamma')])).toBe('2 deals got worse and 1 improved. Biggest concern: Acme.');
    expect(changeTakeaway([], [])).toBe('No deal-level changes in this view since the last run.');
  });

  it('competitorTakeaway picks the biggest threat by value', () => {
    expect(competitorTakeaway([
      { name: 'JobLogic', deals: 3, value: 20_000 },
      { name: 'ServiceM8', deals: 5, value: 9_000 },
    ])).toBe('JobLogic is the biggest threat here: 3 deals worth $20K.');
  });
});
