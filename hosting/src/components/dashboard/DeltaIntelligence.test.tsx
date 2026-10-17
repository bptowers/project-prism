import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeltaIntelligence } from './DeltaIntelligence';
import type { DeltaIntelligenceData } from '@/lib/types';

const malformed = {
  comparedTo: '2026-09-07',
  pipelineTrajectory: {
    direction: 'declining',
    headline: 'Pipeline softening',
    pipelineMrrDelta: '-$12K',
    activeDealsChange: '299 → 299',
    winRateChange: '0% → 0%',
    riskTrajectory: 'More deals stalled',
  },
  regionalTrajectory: 'No regional movement detected.',
  earlyWarnings: 'None identified.',
  significantDealChanges: { improved: 'None', deteriorated: [{ deal: 'Acme', rep: 'Jo', region: 'UK', change: 'Went dark' }] },
  competitiveMomentumShift: { gaining: 'None', losing: 'None', newThreats: 'None' },
} as unknown as DeltaIntelligenceData;

describe('DeltaIntelligence with malformed payload', () => {
  it('renders the trajectory and deal changes and ignores prose in array slots instead of throwing', () => {
    render(<DeltaIntelligence data={malformed} />);
    expect(screen.getByText('Delta Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Pipeline softening')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText(/Early Warnings/)).not.toBeInTheDocument();
  });

  it('renders the comparison date unambiguously rather than as raw ISO', () => {
    render(<DeltaIntelligence data={malformed} />);
    expect(screen.getByText(/vs 7 Sep 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-07/)).not.toBeInTheDocument();
  });
});

describe('DeltaIntelligence empty states', () => {
  it('renders nothing when there is no live report', () => {
    const { container } = render(<DeltaIntelligence data={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the section was not generated when live data lacks it', () => {
    render(<DeltaIntelligence data={undefined} isLive />);
    expect(screen.getByText('Delta Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Not generated for this run')).toBeInTheDocument();
  });
});

describe('DeltaIntelligence hideSummary', () => {
  it('leaves the trajectory, deal changes and warnings to WhatChanged', () => {
    render(<DeltaIntelligence data={malformed} hideSummary />);
    expect(screen.queryByText('Pipeline softening')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('still shows forecast drift and competitor momentum, without the LLM-written comparison date', () => {
    const detail = {
      ...malformed,
      forecastDrift: { previousRealistic: '$100K', currentRealistic: '$90K', delta: 12, driftDirection: 'declining', primaryCause: 'Commit slipped', quarterEndProjection: '' },
      competitiveMomentumShift: { gaining: [{ competitor: 'JobLogic', evidence: 'Two new UK losses' }], losing: 'None' },
    } as unknown as DeltaIntelligenceData;
    render(<DeltaIntelligence data={detail} isLive hideSummary />);
    expect(screen.getByText('Commit slipped')).toBeInTheDocument();
    expect(screen.getByText('JobLogic')).toBeInTheDocument();
    expect(screen.queryByText('Pipeline softening')).not.toBeInTheDocument();
    expect(screen.queryByText(/vs 7 Sep 2026/)).not.toBeInTheDocument();
  });

  it('renders nothing rather than a not-generated panel when there is no extra detail', () => {
    const { container } = render(<DeltaIntelligence data={malformed} isLive hideSummary />);
    expect(container).toBeEmptyDOMElement();
  });
});
