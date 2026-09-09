import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompetitiveDisplacement } from './CompetitiveDisplacement';
import type { CompetitiveDisplacementData } from '@/lib/types';

// Exact shape Gemini returned on 2026-09-09: prose strings in array slots.
const malformed = {
  winMechanisms: {
    UK: {
      primaryCompetitor: 'JobLogic',
      primarySwitchingTrigger: 'Job costing visibility',
      championProfile: 'Ops manager',
      decisiveProofPoint: 'Live demo on their own data',
    },
  },
  lossMechanisms: 'Not available in source data. The provided data covers the active pipeline.',
  regionalArbitrage: 'Not available in source data.',
  rewarmOpportunities: 'Not available in source data.',
} as unknown as CompetitiveDisplacementData;

describe('CompetitiveDisplacement with malformed payload', () => {
  it('renders the win mechanisms and ignores prose in array slots instead of throwing', () => {
    render(<CompetitiveDisplacement data={malformed} />);
    expect(screen.getByText('Competitive Displacement')).toBeInTheDocument();
    expect(screen.getByText(/JobLogic/)).toBeInTheDocument();
    expect(screen.queryByText(/Loss Mechanisms/)).not.toBeInTheDocument();
  });
});
