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
