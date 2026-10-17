import { describe, it, expect } from 'vitest';
import { makeDeal } from '@/test/fixtures';
import type { DeltaDeal } from './types';
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
    expect(driversTakeaway(4, 62, dims)).toBe('Revenue confidence is 62/100. Engagement is the biggest risk driver, then stakeholders.');
  });

  it('copes with no drivers', () => {
    expect(driversTakeaway(2, 90, [{ label: 'Process', value: 0, pipeline: 0 }])).toBe('Revenue confidence is 90/100. No single risk driver stands out.');
  });

  it('does not report a confidence for an empty view', () => {
    expect(driversTakeaway(0, 0, [{ label: 'Process', value: 0, pipeline: 0 }])).toBe('No deals in this view.');
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
    expect(interventionsTakeaway([{ mrr: '$12,000' }, { mrr: '$3K' }])).toBe('2 deals worth $15K (AI-reported) need you personally.');
    expect(interventionsTakeaway([])).toBe('Nothing in this view needs CRO intervention.');
  });

  it('changeTakeaway leads with the biggest concern', () => {
    const d = (deal: string) => ({ deal, rep: 'Jo', region: 'UK', change: 'x' });
    expect(changeTakeaway([d('Acme'), d('Beta')], [d('Gamma')])).toBe('2 deals got worse and 1 improved. Biggest concern: Acme.');
    expect(changeTakeaway([], [])).toBe('No deal-level changes in this view since the last run.');
  });

  it('changeTakeaway ranks the biggest concern by urgency, then MRR, not by input order', () => {
    const d = (deal: string, urgency: string | undefined, mrr: string) => ({ deal, rep: 'Jo', region: 'UK', change: 'x', urgency, mrr });
    const worse = [d('Small', 'P3', '$50K'), d('Unranked', undefined, '$900K'), d('Big', 'P1', '$20K'), d('Bigger', 'P1', '$30K')];
    expect(changeTakeaway(worse, [])).toBe('4 deals got worse and 0 improved. Biggest concern: Bigger.');
  });

  it('changeTakeaway survives malformed LLM rows', () => {
    const malformed = [
      { rep: 'Jo', region: 'UK', change: 'x', urgency: 1, mrr: 5000 },
      { deal: 'Acme', rep: 'Jo', region: 'UK', change: 'x', urgency: 'P2' },
    ] as unknown as DeltaDeal[];
    expect(changeTakeaway(malformed, [])).toBe('2 deals got worse and 0 improved. Biggest concern: Acme.');
    expect(changeTakeaway(malformed.slice(0, 1), [])).toBe('1 deal got worse and 0 improved.');
  });

  it('changeTakeaway breaks a full tie by deal name', () => {
    const d = (deal: string) => ({ deal, rep: 'Jo', region: 'UK', change: 'x', urgency: 'P2', mrr: '$5K' });
    expect(changeTakeaway([d('Zeta'), d('Alpha')], [])).toBe('2 deals got worse and 0 improved. Biggest concern: Alpha.');
  });

  it('competitorTakeaway picks the biggest threat by value alone, never quoting the AI deal count', () => {
    expect(competitorTakeaway([
      { name: 'ServiceM8', deals: 50, value: 9_000 },
      { name: 'JobLogic', deals: 3, value: 20_000 },
    ])).toBe('JobLogic is the biggest threat here: about $20K at risk (AI estimate).');
    // A competitor with AI-reported deals but no value is never the biggest threat while another has a value.
    expect(competitorTakeaway([{ name: 'Fergus', deals: 9, value: 0 }, { name: 'Tradify', deals: 0, value: 3_000 }]))
      .toBe('Tradify is the biggest threat here: about $3K at risk (AI estimate).');
  });

  it('competitorTakeaway counts competitors, not AI deals, when none has a value', () => {
    expect(competitorTakeaway([{ name: 'Fergus', deals: 9, value: 0 }, { name: 'Aroflo', deals: 0, value: 0 }]))
      .toBe('1 competitor is flagged by the AI.');
    expect(competitorTakeaway([{ name: 'Fergus', deals: 9, value: 0 }, { name: 'Tradify', deals: 2, value: 0 }]))
      .toBe('2 competitors are flagged by the AI.');
  });

  it('competitorTakeaway does not call a loss-history-only competitor a threat with 0 deals', () => {
    expect(competitorTakeaway([{ name: 'Aroflo', deals: 0, value: 0 }, { name: 'Fergus', deals: 0, value: 0 }]))
      .toBe('No open deals are flagged against a competitor in this view. 2 competitors appear in past losses.');
  });

  it('changeTakeaway never names an object-valued deal as "[object Object]"', () => {
    const malformed = [{ deal: { name: 'x' }, rep: 'Jo', region: 'UK', change: 'x', urgency: 'P1' }] as unknown as DeltaDeal[];
    expect(changeTakeaway(malformed, [])).toBe('1 deal got worse and 0 improved.');
  });
});

describe('zero-value deals never show $0', () => {
  it('drops the worth clause when there is no value', () => {
    expect(queueTakeaway([makeDeal({ pipelineValue: 0 })], () => false)).toBe('1 deal still needs a look.');
    expect(stageTakeaway([makeDeal({ level: 'HIGH', stage: 'Commit', pipelineValue: 0 })])).toBe('Commit holds 1 HIGH-risk deal.');
    expect(activityTakeaway([makeDeal({ daysStalled: 20, pipelineValue: 0 })])).toBe('1 deal has had no activity for 14+ days.');
    expect(forecastTakeaway([makeDeal({ confidence: 85, healthScore: 20, pipelineValue: 0 })]))
      .toBe('1 deal looks stronger in the forecast than its health suggests.');
    expect(interventionsTakeaway([{ mrr: 'n/a' }])).toBe('1 deal needs you personally.');
    expect(competitorTakeaway([{ name: 'JobLogic', deals: 2, value: 0 }])).toBe('1 competitor is flagged by the AI.');
  });

  it('repTakeaway omits the at-risk clause when nothing is at risk', () => {
    expect(repTakeaway([makeDeal({ rep: 'Jo', healthScore: 20, level: 'LOW', pipelineValue: 0 })]))
      .toBe('Jo has the lowest revenue confidence (20/100).');
  });
});
