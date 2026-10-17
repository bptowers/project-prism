import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DeltaIntelligenceData } from '@/lib/types';
import { WhatChanged } from './WhatChanged';

const delta: DeltaIntelligenceData = {
  comparedTo: '2026-10-11',
  pipelineTrajectory: { direction: 'declining', headline: 'Pipeline softening', pipelineMrrDelta: '-$12K', activeDealsChange: '', winRateChange: '', riskTrajectory: '' },
  significantDealChanges: {
    deteriorated: [
      { deal: 'Acme', rep: 'Jo', region: 'UK', change: 'Champion left' },
      { deal: 'Beta', rep: 'Sam', region: 'North America', change: 'Slipped' },
    ],
    improved: [{ deal: 'Gamma', rep: 'Jo', region: 'UK', change: 'Exec sponsor confirmed' }],
    newPipeline: { count: 6, totalMrr: '$20K', qualityAssessment: 'Mostly early stage' },
  },
  earlyWarnings: [{ signal: 'Three Commit deals have gone quiet', severity: 'critical', affectedMrr: '$30K', recommendedAction: 'Scrub Commit' }],
};

describe('WhatChanged', () => {
  it('leads with direction and the code-computed takeaway, filtered to the region', () => {
    render(<WhatChanged data={delta} region="uk" isLive />);
    expect(screen.getByText('DECLINING')).toBeInTheDocument();
    expect(screen.getByText('1 deal got worse and 1 improved. Biggest concern: Acme.')).toBeInTheDocument();
    expect(screen.getByText('Champion left')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostly early stage/)).not.toBeInTheDocument(); // portfolio-wide, All only
    expect(screen.getByText('Three Commit deals have gone quiet')).toBeInTheDocument();
    expect(screen.getByText("The AI's direction, headline and early warnings cover all regions, not just UK.")).toBeInTheDocument();
  });

  it('shows the AI new-pipeline assessment for All regions, but not its LLM-written count or total', () => {
    render(<WhatChanged data={delta} region="all" isLive />);
    expect(screen.getByText('Mostly early stage')).toBeInTheDocument();
    expect(screen.getByText('New pipeline (AI assessment)')).toBeInTheDocument();
    expect(screen.queryByText(/6 new deals/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$20K/)).not.toBeInTheDocument();
  });

  it('does not present the LLM-written comparison date as fact', () => {
    render(<WhatChanged data={delta} region="all" isLive />);
    expect(screen.queryByText(/11 Oct 2026/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'What changed' })).toBeInTheDocument();
  });

  it('says when the comparison was not generated', () => {
    render(<WhatChanged data={undefined} region="all" isLive />);
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });

  it('says deal-level changes are unavailable rather than claiming nothing changed', () => {
    render(<WhatChanged data={{ pipelineTrajectory: delta.pipelineTrajectory }} region="all" isLive />);
    expect(screen.getByText("Deal-level changes aren't available for this run.")).toBeInTheDocument();
    expect(screen.queryByText(/Got worse/)).not.toBeInTheDocument();
    expect(screen.getByText('Pipeline softening')).toBeInTheDocument();
  });

  it('survives malformed LLM rows', () => {
    const malformed = {
      pipelineTrajectory: { direction: 'constructor', headline: { text: 'x' } },
      significantDealChanges: {
        deteriorated: ['None', null, { deal: { name: 'x' }, region: 7, change: 'Went dark' }, { deal: 'Acme', rep: 'Jo', region: 'UK', change: 'Slipped', mrr: 5000 }],
        improved: 'None',
        newPipeline: 'None',
        exited: { closedWon: [{ deal: 'Delta', region: 'UK', change: { x: 1 } }], closedLost: 'None' },
      },
      earlyWarnings: ['None', { signal: 'Commit is thin', severity: { level: 'high' } }, { severity: 'critical' }],
    } as unknown as DeltaIntelligenceData;
    render(<WhatChanged data={malformed} region="all" isLive />);
    expect(screen.getByText('2 deals got worse and 0 improved. Biggest concern: Acme.')).toBeInTheDocument();
    expect(screen.getByText('Went dark')).toBeInTheDocument();
    expect(screen.getByText('Closed won.')).toBeInTheDocument();
    expect(screen.getByText('Commit is thin')).toBeInTheDocument();
    expect(screen.getByText('Jo · UK · 5000')).toBeInTheDocument();
  });
});
